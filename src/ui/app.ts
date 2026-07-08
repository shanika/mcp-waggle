import type { Server as HttpServer } from 'node:http';

import { count } from 'drizzle-orm';
import express from 'express';

import { openDatabase, type WaggleDatabase } from '../db/index.js';
import {
  RESEARCH_STATUSES,
  TEST_RUN_STATUSES,
  activities,
  researchActivities,
  testRuns,
  type ResearchStatus,
  type TestRunStatus,
} from '../db/schema.js';
import { listActivities } from '../tools/activities.js';
import { readProgress } from '../tools/progress.js';
import { getResearch, listResearch } from '../tools/research.js';
import { getTestRun, listTestRuns } from '../tools/tests.js';
import {
  renderActivityList,
  renderNotFound,
  renderOverview,
  renderProgress,
  renderResearchDetail,
  renderResearchList,
  renderRunDetail,
  renderRunList,
} from './render.js';

function param(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/**
 * Read-only local dashboard over the Waggle database. Deliberately unauthenticated:
 * it binds to loopback for local development and never mutates data.
 */
export function createUiApp(db: WaggleDatabase): express.Express {
  const app = express();

  app.get('/', (_req, res) => {
    res.send(
      renderOverview({
        latestProgress: readProgress(db, { limit: 1 }).latest,
        researches: listResearch(db, { limit: 5 }),
        activities: listActivities(db, { limit: 8 }),
        runs: listTestRuns(db, { limit: 5 }),
        counts: {
          researches: db.select({ n: count() }).from(researchActivities).get()!.n,
          activities: db.select({ n: count() }).from(activities).get()!.n,
          runs: db.select({ n: count() }).from(testRuns).get()!.n,
        },
      }),
    );
  });

  app.get('/researches', (req, res) => {
    const status = oneOf<ResearchStatus>(param(req.query.status), RESEARCH_STATUSES);
    const query = param(req.query.q);
    const rows = listResearch(db, { status, query, limit: 100 });
    res.send(renderResearchList(rows, RESEARCH_STATUSES, status, query));
  });

  app.get('/research/:id', (req, res) => {
    try {
      const research = getResearch(db, { researchId: req.params.id });
      res.send(
        renderResearchDetail({
          ...research,
          activities: research.activities.map((a) => ({
            ...a,
            scope: a.researchId ? ('research' as const) : ('code' as const),
          })),
        }),
      );
    } catch (error) {
      res.status(404).send(renderNotFound((error as Error).message));
    }
  });

  app.get('/activities', (req, res) => {
    const scope = oneOf(param(req.query.scope), ['research', 'code'] as const);
    const query = param(req.query.q);
    res.send(renderActivityList(listActivities(db, { scope, query, limit: 200 }), scope, query));
  });

  app.get('/runs', (req, res) => {
    const status = oneOf<TestRunStatus>(param(req.query.status), TEST_RUN_STATUSES);
    res.send(renderRunList(listTestRuns(db, { status, limit: 100 }), TEST_RUN_STATUSES, status));
  });

  app.get('/runs/:id', (req, res) => {
    try {
      res.send(renderRunDetail(getTestRun(db, { runId: req.params.id })));
    } catch (error) {
      res.status(404).send(renderNotFound((error as Error).message));
    }
  });

  app.get('/progress', (req, res) => {
    const limit = Number.parseInt(param(req.query.limit) ?? '50', 10);
    res.send(renderProgress(readProgress(db, { limit }).history));
  });

  app.use((_req, res) => {
    res.status(404).send(renderNotFound('No such page. The bees have no record of it.'));
  });

  return app;
}

export interface RunningUi {
  server: HttpServer;
  port: number;
  close: () => Promise<void>;
}

/** Boots the dashboard. Used by `waggle ui`. */
export async function runUi(env: NodeJS.ProcessEnv = process.env): Promise<RunningUi> {
  const port = env.WAGGLE_UI_PORT ? Number.parseInt(env.WAGGLE_UI_PORT, 10) : 3204;
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`WAGGLE_UI_PORT is not a valid port: ${env.WAGGLE_UI_PORT}`);
  }
  const host = env.WAGGLE_UI_HOST ?? '127.0.0.1';

  const { db, sqlite } = openDatabase();
  const app = createUiApp(db);

  const server = await new Promise<HttpServer>((resolve, reject) => {
    const s = app.listen(port, host, (err?: Error) => {
      if (err) reject(err);
      else resolve(s);
    });
  });

  const close = async (): Promise<void> => {
    sqlite.close();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  process.once('SIGINT', () => {
    void close().finally(() => process.exit(0));
  });

  console.log(`Waggle dashboard: http://${host}:${port}`);

  return { server, port, close };
}
