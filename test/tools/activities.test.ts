import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listActivities, logActivity } from '../../src/tools/activities.js';
import { getResearch, logResearch } from '../../src/tools/research.js';
import { createTestDatabase, disposeTestDatabase, type TestDatabase } from '../db/setup.js';

describe('activity tools', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    disposeTestDatabase(testDb);
  });

  it('logs a standalone code activity', () => {
    const view = logActivity(testDb.db, {
      activity: 'Added ensureFixtureRepo helper',
      details: 'packages/analyze/src/fixtures.ts',
    });
    expect(view.id).toMatch(/^act_/);
    expect(view.scope).toBe('code');
    expect(view.researchId).toBeNull();
  });

  it('logs an activity linked to a research', () => {
    const research = logResearch(testDb.db, { title: 'Clustering', goal: 'Recover modules' });
    const view = logActivity(testDb.db, {
      activity: 'Ran Louvain over dddsample import graph',
      researchId: research.id,
    });
    expect(view.scope).toBe('research');
    expect(view.researchId).toBe(research.id);
  });

  it('rejects an unknown researchId with a clear error', () => {
    expect(() => logActivity(testDb.db, { activity: 'x', researchId: 'res_nope' })).toThrow(
      /not found/,
    );
  });

  it('lists newest first with researchId, scope, and query filters', () => {
    const research = logResearch(testDb.db, { title: 'A', goal: 'B' });
    logActivity(testDb.db, { activity: 'refactored CLI entry' });
    logActivity(testDb.db, { activity: 'ran clustering experiment', researchId: research.id });

    expect(listActivities(testDb.db)).toHaveLength(2);
    expect(listActivities(testDb.db, { researchId: research.id })).toHaveLength(1);
    expect(listActivities(testDb.db, { scope: 'code' })).toHaveLength(1);
    expect(listActivities(testDb.db, { scope: 'research' })).toHaveLength(1);
    const byQuery = listActivities(testDb.db, { query: 'clustering' });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0].activity).toContain('clustering');
    expect(listActivities(testDb.db, { limit: 1 })).toHaveLength(1);
  });

  it('surfaces linked activities in getResearch', () => {
    const research = logResearch(testDb.db, { title: 'A', goal: 'B' });
    logActivity(testDb.db, { activity: 'step 1', researchId: research.id });
    logActivity(testDb.db, { activity: 'unrelated code work' });
    const fetched = getResearch(testDb.db, { researchId: research.id });
    expect(fetched.activities).toHaveLength(1);
    expect(fetched.activities[0].activity).toBe('step 1');
  });
});
