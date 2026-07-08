import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';

import { count } from 'drizzle-orm';
import express from 'express';
import type { Request, RequestHandler, Response } from 'express';

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
  renderLogin,
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

const SESSION_COOKIE = 'waggle_session';
const SESSION_TTL_MS = 7 * 24 * 3_600_000;

function sessionToken(req: Request): string | undefined {
  const cookies = req.headers.cookie?.split(';') ?? [];
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === SESSION_COOKIE && value) return value;
  }
  return undefined;
}

/** Reject absolute/protocol-relative URLs so ?next= can't open-redirect. */
function safeNext(value: string | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function passwordMatches(submitted: string, expected: string): boolean {
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface UiAppOptions {
  /**
   * The MCP server admin password (OAUTH_ADMIN_PASSWORD) gating the dashboard.
   * Sessions are kept in memory; a restart signs everyone out.
   */
  adminPassword?: string;
}

/** Read-only dashboard over the Waggle database; it never mutates the data. */
export function createUiApp(db: WaggleDatabase, options: UiAppOptions = {}): express.Express {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  if (options.adminPassword !== undefined) {
    const { adminPassword } = options;
    const sessions = new Map<string, number>(); // token -> expiry epoch ms

    const isAuthenticated = (req: Request): boolean => {
      const token = sessionToken(req);
      if (!token) return false;
      const expiresAt = sessions.get(token);
      if (expiresAt === undefined) return false;
      if (expiresAt < Date.now()) {
        sessions.delete(token);
        return false;
      }
      return true;
    };

    app.get('/login', (req, res) => {
      if (isAuthenticated(req)) {
        res.redirect(safeNext(param(req.query.next)));
        return;
      }
      res.send(renderLogin(safeNext(param(req.query.next))));
    });

    app.post('/login', (req, res) => {
      const body = req.body as Record<string, unknown>;
      const next = safeNext(param(body.next));
      const password = param(body.password);
      if (!password || !passwordMatches(password, adminPassword)) {
        res.status(401).send(renderLogin(next, 'Incorrect password.'));
        return;
      }
      const token = randomBytes(32).toString('hex');
      sessions.set(token, Date.now() + SESSION_TTL_MS);
      res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_TTL_MS,
      });
      res.redirect(next);
    });

    app.post('/logout', (req, res) => {
      const token = sessionToken(req);
      if (token) sessions.delete(token);
      res.clearCookie(SESSION_COOKIE);
      res.redirect('/login');
    });

    const requireSession: RequestHandler = (req, res, next) => {
      if (isAuthenticated(req)) {
        next();
        return;
      }
      res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    };
    app.use(requireSession);
  } else {
    // No password configured (tests / explicit opt-out): keep the routes working.
    app.post('/logout', (_req: Request, res: Response) => res.redirect('/'));
  }

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

export interface UiConfig {
  port: number;
  host: string;
  adminPassword: string;
}

/** Required env vars for the dashboard. Throws if the admin password is missing. */
export function parseUiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): UiConfig {
  const adminPassword = env.OAUTH_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      'OAUTH_ADMIN_PASSWORD is required for the dashboard — it is protected by the same admin password as the MCP server',
    );
  }
  const port = env.WAGGLE_UI_PORT ? Number.parseInt(env.WAGGLE_UI_PORT, 10) : 3204;
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`WAGGLE_UI_PORT is not a valid port: ${env.WAGGLE_UI_PORT}`);
  }
  return { port, host: env.WAGGLE_UI_HOST ?? '127.0.0.1', adminPassword };
}

/** Boots the dashboard. Used by `waggle ui`. */
export async function runUi(config: UiConfig = parseUiConfigFromEnv()): Promise<RunningUi> {
  const { port, host, adminPassword } = config;

  const { db, sqlite } = openDatabase();
  const app = createUiApp(db, { adminPassword });

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
