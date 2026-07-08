import type Database from 'better-sqlite3';
import { openDatabase, type WaggleDatabase } from '../../src/db/index.js';

export interface TestDatabase {
  db: WaggleDatabase;
  sqlite: Database.Database;
}

export function createTestDatabase(): TestDatabase {
  return openDatabase({ url: ':memory:' });
}

export function disposeTestDatabase(testDb: TestDatabase): void {
  testDb.sqlite.close();
}
