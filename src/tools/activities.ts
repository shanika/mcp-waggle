import { and, desc, eq, isNotNull, isNull, like, or, type SQL } from 'drizzle-orm';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WaggleDatabase } from '../db/index.js';
import { activities, researchActivities, type Activity } from '../db/schema.js';
import { newActivityId } from '../lib/ids.js';
import { toolHandler } from './result.js';

export interface ActivityView extends Activity {
  scope: 'research' | 'code';
}

function toView(row: Activity): ActivityView {
  return { ...row, scope: row.researchId ? 'research' : 'code' };
}

export interface LogActivityInput {
  activity: string;
  details?: string;
  researchId?: string;
}

export function logActivity(db: WaggleDatabase, input: LogActivityInput): ActivityView {
  if (input.researchId) {
    const research = db
      .select({ id: researchActivities.id })
      .from(researchActivities)
      .where(eq(researchActivities.id, input.researchId))
      .get();
    if (!research) {
      throw new Error(`Research activity not found: ${input.researchId}`);
    }
  }
  const row: Activity = {
    id: newActivityId(),
    activity: input.activity,
    details: input.details ?? null,
    researchId: input.researchId ?? null,
    createdAt: new Date().toISOString(),
  };
  db.insert(activities).values(row).run();
  return toView(row);
}

export interface ListActivitiesInput {
  researchId?: string;
  scope?: 'research' | 'code';
  query?: string;
  limit?: number;
}

export function listActivities(
  db: WaggleDatabase,
  input: ListActivitiesInput = {},
): ActivityView[] {
  const conditions: SQL[] = [];
  if (input.researchId) {
    conditions.push(eq(activities.researchId, input.researchId));
  } else if (input.scope === 'code') {
    conditions.push(isNull(activities.researchId));
  } else if (input.scope === 'research') {
    conditions.push(isNotNull(activities.researchId));
  }
  if (input.query) {
    const pattern = `%${input.query}%`;
    conditions.push(or(like(activities.activity, pattern), like(activities.details, pattern))!);
  }
  const rows = db
    .select()
    .from(activities)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activities.createdAt))
    .limit(input.limit ?? 30)
    .all();
  return rows.map(toView);
}

export function registerActivityTools(server: McpServer, db: WaggleDatabase): void {
  server.registerTool(
    'log_activity',
    {
      title: 'Log development activity',
      description:
        'Record an activity performed during tecture-graph development — a change made, a script run, a decision taken. Link it to a research via researchId when it is part of one; omit researchId for work done directly on the code.',
      inputSchema: {
        activity: z.string().min(1).describe('What was done, in one sentence'),
        details: z.string().optional().describe('Context: files touched, commands run, outcome'),
        researchId: z
          .string()
          .optional()
          .describe('The tecture-graph research this activity belongs to; omit for direct code work'),
      },
    },
    toolHandler((input) => logActivity(db, input)),
  );

  server.registerTool(
    'list_activities',
    {
      title: 'List development activities',
      description:
        'List logged tecture-graph development activities, newest first. Filter by researchId, by scope (research-linked vs direct code work), or by free-text query.',
      inputSchema: {
        researchId: z.string().optional(),
        scope: z
          .enum(['research', 'code'])
          .optional()
          .describe('"research" = linked to a research; "code" = direct development work'),
        query: z.string().optional(),
        limit: z.number().int().positive().max(200).optional().describe('Defaults to 30'),
      },
    },
    toolHandler((input) => listActivities(db, input)),
  );
}
