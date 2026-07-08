import { desc } from 'drizzle-orm';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WaggleDatabase } from '../db/index.js';
import { progressEntries, type ProgressEntry } from '../db/schema.js';
import { newProgressId } from '../lib/ids.js';
import { toolHandler } from './result.js';

export interface WriteProgressInput {
  summary: string;
  details?: string;
}

export function writeProgress(db: WaggleDatabase, input: WriteProgressInput): ProgressEntry {
  const row: ProgressEntry = {
    id: newProgressId(),
    summary: input.summary,
    details: input.details ?? null,
    createdAt: new Date().toISOString(),
  };
  db.insert(progressEntries).values(row).run();
  return row;
}

export interface ReadProgressResult {
  latest: ProgressEntry | null;
  history: ProgressEntry[];
}

export function readProgress(
  db: WaggleDatabase,
  input: { limit?: number } = {},
): ReadProgressResult {
  const history = db
    .select()
    .from(progressEntries)
    .orderBy(desc(progressEntries.createdAt))
    .limit(input.limit ?? 10)
    .all();
  return { latest: history[0] ?? null, history };
}

export function registerProgressTools(server: McpServer, db: WaggleDatabase): void {
  server.registerTool(
    'write_progress',
    {
      title: 'Write project progress',
      description:
        'Append a project progress entry: a snapshot of the overall state of the project (what is done, what is next, blockers). Each write is a new entry; history is preserved.',
      inputSchema: {
        summary: z.string().min(1).describe('Current overall state of the project in a few sentences'),
        details: z.string().optional().describe('Longer notes: done / in flight / next / blockers'),
      },
    },
    toolHandler((input) => writeProgress(db, input)),
  );

  server.registerTool(
    'read_progress',
    {
      title: 'Read project progress',
      description:
        'Read the latest project progress entry plus recent history, newest first. Use this at the start of a session to catch up on where the project stands.',
      inputSchema: {
        limit: z.number().int().positive().max(100).optional().describe('History size, defaults to 10'),
      },
    },
    toolHandler((input) => readProgress(db, input)),
  );
}
