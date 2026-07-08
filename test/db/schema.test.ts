import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { progressEntries, researchActivities, testRuns } from '../../src/db/schema.js';
import { createTestDatabase, disposeTestDatabase, type TestDatabase } from './setup.js';

describe('database schema', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    disposeTestDatabase(testDb);
  });

  it('creates all three tables', () => {
    const tables = testDb.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(tables).toContain('research_activities');
    expect(tables).toContain('test_runs');
    expect(tables).toContain('progress_entries');
  });

  it('creates all indexes', () => {
    const indexes = testDb.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row) => (row as { name: string }).name);
    for (const expected of [
      'idx_research_status',
      'idx_research_created',
      'idx_test_runs_suite',
      'idx_test_runs_status',
      'idx_test_runs_ran',
      'idx_progress_created',
    ]) {
      expect(indexes).toContain(expected);
    }
  });

  it('enforces the test_runs -> research_activities foreign key', () => {
    expect(() =>
      testDb.db
        .insert(testRuns)
        .values({
          id: 'run_orphan',
          suite: 'unit',
          status: 'passed',
          researchId: 'res_does_not_exist',
          ranAt: new Date().toISOString(),
        })
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('applies default values on research_activities and test_runs', () => {
    const now = new Date().toISOString();
    testDb.db
      .insert(researchActivities)
      .values({ id: 'res_1', title: 't', goal: 'g', createdAt: now, updatedAt: now })
      .run();
    const research = testDb.db.select().from(researchActivities).get();
    expect(research?.status).toBe('in_progress');

    testDb.db
      .insert(testRuns)
      .values({ id: 'run_1', suite: 'unit', status: 'passed', ranAt: now })
      .run();
    const run = testDb.db.select().from(testRuns).get();
    expect(run?.total).toBe(0);
    expect(run?.passed).toBe(0);
    expect(run?.failed).toBe(0);
    expect(run?.skipped).toBe(0);
  });

  it('supports CRUD on progress_entries', () => {
    const now = new Date().toISOString();
    testDb.db
      .insert(progressEntries)
      .values({ id: 'prog_1', summary: 'started', createdAt: now })
      .run();
    const rows = testDb.db.select().from(progressEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].details).toBeNull();
  });
});
