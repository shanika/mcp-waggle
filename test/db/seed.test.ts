import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedDatabase } from '../../src/db/seed.js';
import { listActivities } from '../../src/tools/activities.js';
import { readProgress } from '../../src/tools/progress.js';
import { getResearch, listResearch } from '../../src/tools/research.js';
import { listTestRuns } from '../../src/tools/tests.js';
import { createTestDatabase, disposeTestDatabase, type TestDatabase } from './setup.js';

describe('seedDatabase', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    disposeTestDatabase(testDb);
  });

  it('populates every table', () => {
    const inserted = seedDatabase(testDb.db);

    expect(inserted.researches).toBeGreaterThan(0);
    expect(inserted.activities).toBeGreaterThan(0);
    expect(inserted.testRuns).toBeGreaterThan(0);
    expect(inserted.progressEntries).toBeGreaterThan(0);

    expect(listResearch(testDb.db).length).toBe(inserted.researches);
    expect(listActivities(testDb.db, { limit: 200 }).length).toBe(inserted.activities);
    expect(listTestRuns(testDb.db).length).toBe(inserted.testRuns);
    expect(readProgress(testDb.db, { limit: 100 }).history.length).toBe(inserted.progressEntries);
  });

  it('is idempotent — re-running inserts nothing', () => {
    const first = seedDatabase(testDb.db);
    const second = seedDatabase(testDb.db);

    expect(second).toEqual({ researches: 0, activities: 0, testRuns: 0, progressEntries: 0 });
    expect(listResearch(testDb.db).length).toBe(first.researches);
  });

  it('links activities and test runs to the CodeGraph survey research', () => {
    seedDatabase(testDb.db);

    const research = getResearch(testDb.db, { researchId: 'res_CmR_jwPkQ-8WiaSJH0xxj' });
    expect(research.status).toBe('completed');
    expect(research.tags).toContain('codegraph');
    expect(research.activities.length).toBeGreaterThan(0);
    expect(research.testRuns.length).toBeGreaterThan(0);
    expect(research.testRuns[0]!.status).toBe('passed');
  });

  it('includes both research-linked and direct code activities', () => {
    seedDatabase(testDb.db);

    expect(listActivities(testDb.db, { scope: 'research' }).length).toBeGreaterThan(0);
    expect(listActivities(testDb.db, { scope: 'code' }).length).toBeGreaterThan(0);
  });

  it('keeps the progress journal in chronological order, newest first', () => {
    seedDatabase(testDb.db);

    const { latest, history } = readProgress(testDb.db, { limit: 100 });
    expect(latest?.id).toBe('prog_ES1W0vG32kmXBfPpTPenH');
    const times = history.map((p) => new Date(p.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});
