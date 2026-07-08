import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { logResearch } from '../../src/tools/research.js';
import { getTestRun, listTestRuns, publishTestResults } from '../../src/tools/tests.js';
import { createTestDatabase, disposeTestDatabase, type TestDatabase } from '../db/setup.js';

describe('test run tools', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    disposeTestDatabase(testDb);
  });

  it('derives status and total from the counts', () => {
    const passing = publishTestResults(testDb.db, { suite: 'unit', passed: 10, failed: 0, skipped: 2 });
    expect(passing.id).toMatch(/^run_/);
    expect(passing.status).toBe('passed');
    expect(passing.total).toBe(12);

    const failing = publishTestResults(testDb.db, { suite: 'unit', passed: 9, failed: 1 });
    expect(failing.status).toBe('failed');
    expect(failing.total).toBe(10);
  });

  it('stores optional fields and links to research', () => {
    const research = logResearch(testDb.db, { title: 'A', goal: 'B' });
    const run = publishTestResults(testDb.db, {
      suite: 'integration',
      passed: 1,
      failed: 1,
      durationMs: 4200,
      summary: 'one regression',
      output: 'AssertionError: expected 3 containers, got 2',
      researchId: research.id,
    });
    expect(run.durationMs).toBe(4200);
    expect(run.researchId).toBe(research.id);
    const fetched = getTestRun(testDb.db, { runId: run.id });
    expect(fetched.output).toContain('AssertionError');
  });

  it('rejects unknown researchId with a clear error', () => {
    expect(() =>
      publishTestResults(testDb.db, { suite: 'unit', passed: 1, failed: 0, researchId: 'res_nope' }),
    ).toThrow(/not found/);
  });

  it('lists newest first with suite and status filters', () => {
    publishTestResults(testDb.db, { suite: 'unit', passed: 1, failed: 0 });
    publishTestResults(testDb.db, { suite: 'integration', passed: 0, failed: 1 });

    expect(listTestRuns(testDb.db)).toHaveLength(2);
    expect(listTestRuns(testDb.db, { suite: 'unit' })).toHaveLength(1);
    const failed = listTestRuns(testDb.db, { status: 'failed' });
    expect(failed).toHaveLength(1);
    expect(failed[0].suite).toBe('integration');
    expect(listTestRuns(testDb.db, { limit: 1 })).toHaveLength(1);
  });

  it('throws for unknown run ids', () => {
    expect(() => getTestRun(testDb.db, { runId: 'run_nope' })).toThrow(/not found/);
  });
});
