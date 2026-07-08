import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

export type WaggleDatabase = BetterSQLite3Database<typeof schema>;

const moduleDir = dirname(fileURLToPath(import.meta.url));

// In src/ the migrations sit next to this file (src/db/migrations); in the
// bundled dist/ they are copied to dist/migrations next to the single bundle.
function resolveMigrationsFolder(): string {
  const candidates = [join(moduleDir, 'migrations'), join(moduleDir, 'db', 'migrations')];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Could not locate migrations folder near ${moduleDir}`);
  }
  return found;
}

export function defaultDbPath(): string {
  return join(homedir(), '.waggle', 'waggle.db');
}

export interface OpenDatabaseOptions {
  url?: string;
  runMigrations?: boolean;
  migrationsFolder?: string;
}

export function openDatabase(options: OpenDatabaseOptions = {}): {
  db: WaggleDatabase;
  sqlite: Database.Database;
} {
  const url = options.url ?? process.env.DB_PATH ?? defaultDbPath();
  if (url !== ':memory:') {
    mkdirSync(dirname(url), { recursive: true });
  }
  const sqlite = new Database(url);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  if (options.runMigrations ?? true) {
    migrate(db, { migrationsFolder: options.migrationsFolder ?? resolveMigrationsFolder() });
  }
  return { db, sqlite };
}
