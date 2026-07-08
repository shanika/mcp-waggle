import { and, desc, eq, like, or, type SQL } from 'drizzle-orm';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WaggleDatabase } from '../db/index.js';
import {
  RESEARCH_STATUSES,
  activities,
  researchActivities,
  testRuns,
  type Activity,
  type ResearchActivity,
  type ResearchStatus,
  type TestRun,
} from '../db/schema.js';
import { newResearchId } from '../lib/ids.js';
import { toolHandler } from './result.js';

export interface ResearchView {
  id: string;
  title: string;
  goal: string;
  status: string;
  results: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function toView(row: ResearchActivity): ResearchView {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    results: row.results,
    tags: row.tags ? row.tags.split(',') : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface LogResearchInput {
  title: string;
  goal: string;
  results?: string;
  status?: ResearchStatus;
  tags?: string[];
}

export function logResearch(db: WaggleDatabase, input: LogResearchInput): ResearchView {
  const now = new Date().toISOString();
  const row: ResearchActivity = {
    id: newResearchId(),
    title: input.title,
    goal: input.goal,
    status: input.status ?? 'in_progress',
    results: input.results ?? null,
    tags: input.tags && input.tags.length > 0 ? input.tags.join(',') : null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(researchActivities).values(row).run();
  return toView(row);
}

export interface UpdateResearchInput {
  researchId: string;
  results?: string;
  status?: ResearchStatus;
}

export function updateResearch(db: WaggleDatabase, input: UpdateResearchInput): ResearchView {
  const existing = db
    .select()
    .from(researchActivities)
    .where(eq(researchActivities.id, input.researchId))
    .get();
  if (!existing) {
    throw new Error(`Research activity not found: ${input.researchId}`);
  }
  if (input.results === undefined && input.status === undefined) {
    throw new Error('Nothing to update — provide results and/or status');
  }
  const updated = db
    .update(researchActivities)
    .set({
      ...(input.results !== undefined ? { results: input.results } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(researchActivities.id, input.researchId))
    .returning()
    .get();
  return toView(updated!);
}

export interface ListResearchInput {
  status?: ResearchStatus;
  query?: string;
  limit?: number;
}

export function listResearch(db: WaggleDatabase, input: ListResearchInput = {}): ResearchView[] {
  const conditions: SQL[] = [];
  if (input.status) {
    conditions.push(eq(researchActivities.status, input.status));
  }
  if (input.query) {
    const pattern = `%${input.query}%`;
    conditions.push(
      or(
        like(researchActivities.title, pattern),
        like(researchActivities.goal, pattern),
        like(researchActivities.results, pattern),
      )!,
    );
  }
  const rows = db
    .select()
    .from(researchActivities)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(researchActivities.createdAt))
    .limit(input.limit ?? 20)
    .all();
  return rows.map(toView);
}

export function getResearch(
  db: WaggleDatabase,
  input: { researchId: string },
): ResearchView & { testRuns: Omit<TestRun, 'report'>[]; activities: Activity[] } {
  const row = db
    .select()
    .from(researchActivities)
    .where(eq(researchActivities.id, input.researchId))
    .get();
  if (!row) {
    throw new Error(`Research activity not found: ${input.researchId}`);
  }
  const runs = db
    .select()
    .from(testRuns)
    .where(eq(testRuns.researchId, input.researchId))
    .orderBy(desc(testRuns.ranAt))
    .all()
    // The per-test report can be large — fetch it via get_test_run instead.
    .map(({ report: _report, ...rest }) => rest);
  const linkedActivities = db
    .select()
    .from(activities)
    .where(eq(activities.researchId, input.researchId))
    .orderBy(desc(activities.createdAt))
    .all();
  return { ...toView(row), testRuns: runs, activities: linkedActivities };
}

export function registerResearchTools(server: McpServer, db: WaggleDatabase): void {
  server.registerTool(
    'log_tecture_research',
    {
      title: 'Log tecture-graph research',
      description:
        'Record a tecture-graph research: what is being investigated and why. Specific to the tecture-graph project — not a general research log. Set results/status now, or update them later with update_tecture_research once the experiment concludes.',
      inputSchema: {
        title: z.string().min(1).describe('Short name for the research step'),
        goal: z.string().min(1).describe('The question this research step answers / why it is being done'),
        results: z.string().optional().describe('Findings so far, if any'),
        status: z.enum(RESEARCH_STATUSES).optional().describe('Defaults to in_progress'),
        tags: z.array(z.string()).optional().describe('Freeform tags for grouping'),
      },
    },
    toolHandler((input) => logResearch(db, input)),
  );

  server.registerTool(
    'update_tecture_research',
    {
      title: 'Update tecture-graph research',
      description:
        'Update the results and/or status of a previously logged tecture-graph research.',
      inputSchema: {
        researchId: z.string().min(1),
        results: z.string().optional().describe('Findings / outcome (replaces previous results)'),
        status: z.enum(RESEARCH_STATUSES).optional(),
      },
    },
    toolHandler((input) => updateResearch(db, input)),
  );

  server.registerTool(
    'list_tecture_researches',
    {
      title: 'List tecture-graph researches',
      description:
        'List logged tecture-graph researches, newest first. Filter by status or free-text query over title/goal/results.',
      inputSchema: {
        status: z.enum(RESEARCH_STATUSES).optional(),
        query: z.string().optional(),
        limit: z.number().int().positive().max(100).optional().describe('Defaults to 20'),
      },
    },
    toolHandler((input) => listResearch(db, input)),
  );

  server.registerTool(
    'get_tecture_research',
    {
      title: 'Get tecture-graph research',
      description:
        'Get a single tecture-graph research by id, including its linked test runs and development activities.',
      inputSchema: {
        researchId: z.string().min(1),
      },
    },
    toolHandler((input) => getResearch(db, input)),
  );
}
