import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getResearch,
  listResearch,
  logResearch,
  updateResearch,
} from '../../src/tools/research.js';
import { publishTestResults } from '../../src/tools/tests.js';
import { createTestDatabase, disposeTestDatabase, type TestDatabase } from '../db/setup.js';

describe('research tools', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    disposeTestDatabase(testDb);
  });

  it('logs a research activity with defaults', () => {
    const view = logResearch(testDb.db, {
      title: 'Import graph clustering',
      goal: 'Does Louvain clustering over the import graph recover the Maven modules?',
    });
    expect(view.id).toMatch(/^res_/);
    expect(view.status).toBe('in_progress');
    expect(view.results).toBeNull();
    expect(view.tags).toEqual([]);
  });

  it('logs a research activity with results, status and tags', () => {
    const view = logResearch(testDb.db, {
      title: 'Baseline',
      goal: 'Establish baseline',
      results: 'Works',
      status: 'completed',
      tags: ['clustering', 'baseline'],
    });
    expect(view.status).toBe('completed');
    expect(view.results).toBe('Works');
    expect(view.tags).toEqual(['clustering', 'baseline']);
  });

  it('updates results and status', () => {
    const created = logResearch(testDb.db, { title: 'A', goal: 'B' });
    const updated = updateResearch(testDb.db, {
      researchId: created.id,
      results: 'It converged',
      status: 'completed',
    });
    expect(updated.results).toBe('It converged');
    expect(updated.status).toBe('completed');
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it('rejects updates to unknown ids and empty updates', () => {
    expect(() => updateResearch(testDb.db, { researchId: 'res_nope', results: 'x' })).toThrow(
      /not found/,
    );
    const created = logResearch(testDb.db, { title: 'A', goal: 'B' });
    expect(() => updateResearch(testDb.db, { researchId: created.id })).toThrow(
      /Nothing to update/,
    );
  });

  it('lists newest first with status and query filters', () => {
    logResearch(testDb.db, { title: 'First', goal: 'clustering experiment' });
    const second = logResearch(testDb.db, { title: 'Second', goal: 'edge weighting' });
    updateResearch(testDb.db, { researchId: second.id, status: 'completed' });

    const all = listResearch(testDb.db);
    expect(all).toHaveLength(2);

    const completed = listResearch(testDb.db, { status: 'completed' });
    expect(completed).toHaveLength(1);
    expect(completed[0].title).toBe('Second');

    const byQuery = listResearch(testDb.db, { query: 'clustering' });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0].title).toBe('First');

    expect(listResearch(testDb.db, { limit: 1 })).toHaveLength(1);
  });

  it('gets a research activity with its linked test runs', () => {
    const research = logResearch(testDb.db, { title: 'A', goal: 'B' });
    publishTestResults(testDb.db, {
      suite: 'clustering',
      passed: 3,
      failed: 0,
      researchId: research.id,
    });
    const fetched = getResearch(testDb.db, { researchId: research.id });
    expect(fetched.testRuns).toHaveLength(1);
    expect(fetched.testRuns[0].suite).toBe('clustering');
    expect(() => getResearch(testDb.db, { researchId: 'res_nope' })).toThrow(/not found/);
  });
});
