import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getResearch, logResearch } from '../../src/tools/research.js';
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

  it('derives counts, total and status from a per-test report', () => {
    const run = publishTestResults(testDb.db, {
      suite: 'pnpm test',
      tests: [
        { name: 'a > passes', status: 'passed', file: 'test/a.test.ts', durationMs: 12 },
        { name: 'a > also passes', status: 'passed', file: 'test/a.test.ts', durationMs: 3 },
        {
          name: 'b > breaks',
          status: 'failed',
          file: 'test/b.test.ts',
          error: 'AssertionError: expected 1 to be 2',
          logs: 'console.log before failing',
        },
        { name: 'b > not yet', status: 'skipped', file: 'test/b.test.ts' },
      ],
    });
    expect(run.status).toBe('failed');
    expect(run.total).toBe(4);
    expect(run.passed).toBe(2);
    expect(run.failed).toBe(1);
    expect(run.skipped).toBe(1);
  });

  it('round-trips the per-test report through getTestRun', () => {
    const run = publishTestResults(testDb.db, {
      suite: 'pnpm test',
      tests: [
        { name: 'x > works', status: 'passed', file: 'test/x.test.ts', durationMs: 5, logs: 'hello' },
      ],
    });
    const fetched = getTestRun(testDb.db, { runId: run.id });
    expect(fetched.tests).toEqual([
      { name: 'x > works', status: 'passed', file: 'test/x.test.ts', durationMs: 5, logs: 'hello' },
    ]);
    expect(fetched).not.toHaveProperty('report');
  });

  it('omits the report from lists and research-linked runs', () => {
    const research = logResearch(testDb.db, { title: 'A', goal: 'B' });
    publishTestResults(testDb.db, {
      suite: 'pnpm test',
      researchId: research.id,
      tests: [{ name: 'x', status: 'passed' }],
    });
    expect(listTestRuns(testDb.db)[0]).not.toHaveProperty('report');
    expect(getResearch(testDb.db, { researchId: research.id }).testRuns[0]).not.toHaveProperty(
      'report',
    );
  });

  it('requires either counts or a tests[] report', () => {
    expect(() => publishTestResults(testDb.db, { suite: 'unit' })).toThrow(/passed\/failed counts/);
    expect(() => publishTestResults(testDb.db, { suite: 'unit', passed: 1 })).toThrow(
      /passed\/failed counts/,
    );
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
