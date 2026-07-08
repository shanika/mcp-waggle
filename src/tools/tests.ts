import { and, desc, eq, type SQL } from 'drizzle-orm';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WaggleDatabase } from '../db/index.js';
import {
  TEST_RUN_STATUSES,
  researchActivities,
  testRuns,
  type TestRun,
  type TestRunStatus,
} from '../db/schema.js';
import { newTestRunId } from '../lib/ids.js';
import { toolHandler } from './result.js';

export interface PublishTestResultsInput {
  suite: string;
  passed: number;
  failed: number;
  skipped?: number;
  durationMs?: number;
  summary?: string;
  output?: string;
  researchId?: string;
}

export function publishTestResults(db: WaggleDatabase, input: PublishTestResultsInput): TestRun {
  if (input.researchId) {
    const research = db
      .select({ id: researchActivities.id })
      .from(researchActivities)
      .where(eq(researchActivities.id, input.researchId))
      .get();
    if (!research) {
      throw new Error(`Research activity not found: ${input.researchId}`);
    }
  }
  const skipped = input.skipped ?? 0;
  const row: TestRun = {
    id: newTestRunId(),
    suite: input.suite,
    status: input.failed > 0 ? 'failed' : 'passed',
    total: input.passed + input.failed + skipped,
    passed: input.passed,
    failed: input.failed,
    skipped,
    durationMs: input.durationMs ?? null,
    summary: input.summary ?? null,
    output: input.output ?? null,
    researchId: input.researchId ?? null,
    ranAt: new Date().toISOString(),
  };
  db.insert(testRuns).values(row).run();
  return row;
}

export interface ListTestRunsInput {
  suite?: string;
  status?: TestRunStatus;
  limit?: number;
}

export function listTestRuns(db: WaggleDatabase, input: ListTestRunsInput = {}): TestRun[] {
  const conditions: SQL[] = [];
  if (input.suite) {
    conditions.push(eq(testRuns.suite, input.suite));
  }
  if (input.status) {
    conditions.push(eq(testRuns.status, input.status));
  }
  return db
    .select()
    .from(testRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(testRuns.ranAt))
    .limit(input.limit ?? 20)
    .all();
}

export function getTestRun(db: WaggleDatabase, input: { runId: string }): TestRun {
  const row = db.select().from(testRuns).where(eq(testRuns.id, input.runId)).get();
  if (!row) {
    throw new Error(`Test run not found: ${input.runId}`);
  }
  return row;
}

export function registerTestRunTools(server: McpServer, db: WaggleDatabase): void {
  server.registerTool(
    'publish_test_results',
    {
      title: 'Publish test results',
      description:
        'Record the outcome of a test run (suite name + pass/fail/skip counts). Status and total are derived from the counts. Optionally link the run to a research activity via researchId.',
      inputSchema: {
        suite: z.string().min(1).describe('Name of the test suite or command, e.g. "pnpm test"'),
        passed: z.number().int().min(0),
        failed: z.number().int().min(0),
        skipped: z.number().int().min(0).optional().describe('Defaults to 0'),
        durationMs: z.number().int().min(0).optional(),
        summary: z.string().optional().describe('One-line human summary of the run'),
        output: z.string().optional().describe('Relevant test output, e.g. failure messages'),
        researchId: z.string().optional().describe('Link this run to a logged research activity'),
      },
    },
    toolHandler((input) => publishTestResults(db, input)),
  );

  server.registerTool(
    'list_test_runs',
    {
      title: 'List test runs',
      description: 'List published test runs, newest first. Filter by suite and/or status.',
      inputSchema: {
        suite: z.string().optional(),
        status: z.enum(TEST_RUN_STATUSES).optional(),
        limit: z.number().int().positive().max(100).optional().describe('Defaults to 20'),
      },
    },
    toolHandler((input) => listTestRuns(db, input)),
  );

  server.registerTool(
    'get_test_run',
    {
      title: 'Get test run',
      description: 'Get a single published test run by id, including its full output.',
      inputSchema: {
        runId: z.string().min(1),
      },
    },
    toolHandler((input) => getTestRun(db, input)),
  );
}
