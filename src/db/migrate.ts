import { openDatabase } from './index.js';

export function runMigrations(): void {
  const { sqlite } = openDatabase();
  sqlite.close();
  console.error('waggle: migrations applied');
}
