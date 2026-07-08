import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProgress, writeProgress } from '../../src/tools/progress.js';
import { createTestDatabase, disposeTestDatabase, type TestDatabase } from '../db/setup.js';

describe('progress tools', () => {
  let testDb: TestDatabase;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  afterEach(() => {
    disposeTestDatabase(testDb);
  });

  it('reads empty progress', () => {
    const result = readProgress(testDb.db);
    expect(result.latest).toBeNull();
    expect(result.history).toEqual([]);
  });

  it('appends entries and reads newest first', () => {
    writeProgress(testDb.db, { summary: 'walking skeleton done' });
    const second = writeProgress(testDb.db, {
      summary: 'fixture repos wired up',
      details: 'Next: containers detection',
    });
    // createdAt has second precision in ISO strings under fast inserts; force ordering
    testDb.sqlite
      .prepare('UPDATE progress_entries SET created_at = ? WHERE id = ?')
      .run(new Date(Date.now() + 1000).toISOString(), second.id);

    const result = readProgress(testDb.db);
    expect(result.history).toHaveLength(2);
    expect(result.latest?.summary).toBe('fixture repos wired up');
    expect(result.latest?.details).toContain('containers detection');
    expect(readProgress(testDb.db, { limit: 1 }).history).toHaveLength(1);
  });
});
