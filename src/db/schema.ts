import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const RESEARCH_STATUSES = ['in_progress', 'completed', 'abandoned'] as const;
export type ResearchStatus = (typeof RESEARCH_STATUSES)[number];

export const TEST_RUN_STATUSES = ['passed', 'failed'] as const;
export type TestRunStatus = (typeof TEST_RUN_STATUSES)[number];

export const TEST_CASE_STATUSES = ['passed', 'failed', 'skipped'] as const;
export type TestCaseStatus = (typeof TEST_CASE_STATUSES)[number];

/** One test case inside a run's report (stored as JSON in test_runs.report). */
export interface TestCaseResult {
  /** Full test name including describe blocks, e.g. "dashboard app > renders the overview". */
  name: string;
  status: TestCaseStatus;
  /** Test file, e.g. "test/ui/app.test.ts". */
  file?: string;
  durationMs?: number;
  /** Failure message + stack, for failed tests. */
  error?: string;
  /** Console output captured while this test ran. */
  logs?: string;
}

export const researchActivities = sqliteTable(
  'research_activities',
  {
    id: text('id').primaryKey(), // res_<nanoid>
    title: text('title').notNull(),
    goal: text('goal').notNull(),
    status: text('status').notNull().default('in_progress'), // in_progress | completed | abandoned
    results: text('results'),
    tags: text('tags'), // comma-separated
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_research_status').on(t.status),
    index('idx_research_created').on(t.createdAt),
  ],
);

export const testRuns = sqliteTable(
  'test_runs',
  {
    id: text('id').primaryKey(), // run_<nanoid>
    suite: text('suite').notNull(),
    status: text('status').notNull(), // passed | failed
    total: integer('total').notNull().default(0),
    passed: integer('passed').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    durationMs: integer('duration_ms'),
    summary: text('summary'),
    output: text('output'),
    report: text('report'), // JSON array of TestCaseResult — the full per-test report

    researchId: text('research_id').references(() => researchActivities.id),
    ranAt: text('ran_at').notNull(),
  },
  (t) => [
    index('idx_test_runs_suite').on(t.suite),
    index('idx_test_runs_status').on(t.status),
    index('idx_test_runs_ran').on(t.ranAt),
  ],
);

export const activities = sqliteTable(
  'activities',
  {
    id: text('id').primaryKey(), // act_<nanoid>
    activity: text('activity').notNull(),
    details: text('details'),
    // NULL = general development activity directly on the code;
    // set = activity performed as part of that research.
    researchId: text('research_id').references(() => researchActivities.id),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_activities_research').on(t.researchId),
    index('idx_activities_created').on(t.createdAt),
  ],
);

export const progressEntries = sqliteTable(
  'progress_entries',
  {
    id: text('id').primaryKey(), // prog_<nanoid>
    summary: text('summary').notNull(),
    details: text('details'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_progress_created').on(t.createdAt)],
);

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type ResearchActivity = typeof researchActivities.$inferSelect;
export type NewResearchActivity = typeof researchActivities.$inferInsert;
export type TestRun = typeof testRuns.$inferSelect;
export type NewTestRun = typeof testRuns.$inferInsert;
export type ProgressEntry = typeof progressEntries.$inferSelect;
export type NewProgressEntry = typeof progressEntries.$inferInsert;
