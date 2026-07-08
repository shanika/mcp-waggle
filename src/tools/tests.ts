import { and, desc, eq, type SQL } from 'drizzle-orm';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WaggleDatabase } from '../db/index.js';
import {
  TEST_CASE_STATUSES,
  TEST_RUN_STATUSES,
  researchActivities,
  testRuns,
  type TestCaseResult,
  type TestRun,
  type TestRunStatus,
} from '../db/schema.js';
import { newTestRunId } from '../lib/ids.js';
import { toolHandler } from './result.js';

/** A test run with the JSON report column parsed into per-test results. */
export type TestRunView = Omit<TestRun, 'report'> & { tests: TestCaseResult[] | null };

function toView(row: TestRun): TestRunView {
  const { report, ...rest } = row;
  return { ...rest, tests: report ? (JSON.parse(report) as TestCaseResult[]) : null };
}

export interface PublishTestResultsInput {
  suite: string;
  passed?: number;
  failed?: number;
  skipped?: number;
  durationMs?: number;
  summary?: string;
  output?: string;
  tests?: TestCaseResult[];
  researchId?: string;
}

export function publishTestResults(
  db: WaggleDatabase,
  input: PublishTestResultsInput,
): TestRunView {
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
  // The per-test report is the source of truth for the counts when provided.
  const counts = input.tests
    ? {
        passed: input.tests.filter((t) => t.status === 'passed').length,
        failed: input.tests.filter((t) => t.status === 'failed').length,
        skipped: input.tests.filter((t) => t.status === 'skipped').length,
      }
    : { passed: input.passed, failed: input.failed, skipped: input.skipped ?? 0 };
  if (counts.passed === undefined || counts.failed === undefined) {
    throw new Error('Provide passed/failed counts, or a tests[] report to derive them from');
  }
  const row: TestRun = {
    id: newTestRunId(),
    suite: input.suite,
    status: counts.failed > 0 ? 'failed' : 'passed',
    total: counts.passed + counts.failed + counts.skipped,
    passed: counts.passed,
    failed: counts.failed,
    skipped: counts.skipped,
    durationMs: input.durationMs ?? null,
    summary: input.summary ?? null,
    output: input.output ?? null,
    report: input.tests ? JSON.stringify(input.tests) : null,
    researchId: input.researchId ?? null,
    ranAt: new Date().toISOString(),
  };
  db.insert(testRuns).values(row).run();
  return toView(row);
}

export interface ListTestRunsInput {
  suite?: string;
  status?: TestRunStatus;
  limit?: number;
}

/** Lists runs without the (potentially large) per-test report — use getTestRun for that. */
export function listTestRuns(
  db: WaggleDatabase,
  input: ListTestRunsInput = {},
): Omit<TestRun, 'report'>[] {
  const conditions: SQL[] = [];
  if (input.suite) {
    conditions.push(eq(testRuns.suite, input.suite));
  }
  if (input.status) {
    conditions.push(eq(testRuns.status, input.status));
  }
  const rows = db
    .select()
    .from(testRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(testRuns.ranAt))
    .limit(input.limit ?? 20)
    .all();
  return rows.map(({ report: _report, ...rest }) => rest);
}

export function getTestRun(db: WaggleDatabase, input: { runId: string }): TestRunView {
  const row = db.select().from(testRuns).where(eq(testRuns.id, input.runId)).get();
  if (!row) {
    throw new Error(`Test run not found: ${input.runId}`);
  }
  return toView(row);
}

export function registerTestRunTools(server: McpServer, db: WaggleDatabase): void {
  server.registerTool(
    'publish_test_results',
    {
      title: 'Publish test results',
      description:
        'Record the outcome of a test run. ALWAYS publish the FULL report, not just counts: pass tests[] with one entry per test — the full test name (what was tested), its status, file, duration, the error message + stack for failures, and the console output the test produced. For Vitest, note that the built-in JSON reporter does NOT emit per-test console logs; run with a small custom reporter that captures onUserConsoleLog (log.taskId matches TestCase.id) and emits { suite, durationMs, tests[] } — the Waggle repo ships one at scripts/vitest-waggle-reporter.mjs (vitest run --reporter=default --reporter=<path>), and its output file can be passed to this tool verbatim. If no such reporter is available, build tests[] from the JSON reporter (testResults[].assertionResults[]: fullName/status/duration/failureMessages) and leave logs out. When tests[] is provided the passed/failed/skipped counts and overall status are derived from it; only fall back to bare counts when per-test detail is genuinely unavailable. Use output for run-level logs that belong to no single test, and optionally link the run to a research via researchId.',
      inputSchema: {
        suite: z.string().min(1).describe('Name of the test suite or command, e.g. "pnpm test"'),
        passed: z.number().int().min(0).optional().describe('Derived from tests[] when provided'),
        failed: z.number().int().min(0).optional().describe('Derived from tests[] when provided'),
        skipped: z.number().int().min(0).optional().describe('Derived from tests[] when provided; else defaults to 0'),
        durationMs: z.number().int().min(0).optional().describe('Wall-clock duration of the whole run'),
        summary: z.string().optional().describe('One-line human summary of the run'),
        output: z.string().optional().describe('Run-level output not tied to a single test, e.g. reporter summary or build warnings'),
        tests: z
          .array(
            z.object({
              name: z
                .string()
                .min(1)
                .describe('Full test name including describe blocks — what was tested'),
              status: z.enum(TEST_CASE_STATUSES),
              file: z.string().optional().describe('Test file path, e.g. "test/ui/app.test.ts"'),
              durationMs: z.number().int().min(0).optional(),
              error: z.string().optional().describe('Failure message + stack (failed tests)'),
              logs: z.string().optional().describe('Console output captured while this test ran'),
            }),
          )
          .optional()
          .describe('The full per-test report — include every test in the run'),
        researchId: z.string().optional().describe('Link this run to a logged research activity'),
      },
    },
    toolHandler((input) => publishTestResults(db, input)),
  );

  server.registerTool(
    'list_test_runs',
    {
      title: 'List test runs',
      description:
        'List published test runs, newest first, without their per-test reports (use get_test_run for the full report). Filter by suite and/or status.',
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
      description:
        'Get a single published test run by id, including its full per-test report (tests[]) and run-level output.',
      inputSchema: {
        runId: z.string().min(1),
      },
    },
    toolHandler((input) => getTestRun(db, input)),
  );
}
