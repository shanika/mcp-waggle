import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedDatabase } from '../../src/db/seed.js';
import { publishTestResults } from '../../src/tools/tests.js';
import { escapeHtml, timeAgo } from '../../src/ui/render.js';
import { createUiApp } from '../../src/ui/app.js';
import { createTestDatabase, disposeTestDatabase, type TestDatabase } from '../db/setup.js';

const RESEARCH_ID = 'res_CmR_jwPkQ-8WiaSJH0xxj';
const RUN_ID = 'run_dBITFCRO0e1vBl7qLLahl';

describe('dashboard app', () => {
  let testDb: TestDatabase;
  let app: ReturnType<typeof createUiApp>;

  beforeEach(() => {
    testDb = createTestDatabase();
    seedDatabase(testDb.db);
    app = createUiApp(testDb.db);
  });

  afterEach(() => {
    disposeTestDatabase(testDb);
  });

  it('renders the overview with counts and latest progress', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Waggle');
    expect(res.text).toContain('Latest progress');
    expect(res.text).toContain('reference projects');
    expect(res.text).toContain(RESEARCH_ID);
  });

  it('renders the overview on an empty database', async () => {
    const empty = createTestDatabase();
    try {
      const res = await request(createUiApp(empty.db)).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('No progress written yet');
      expect(res.text).toContain('No researches logged yet');
      expect(res.text).toContain('No test runs yet');
    } finally {
      disposeTestDatabase(empty);
    }
  });

  it('lists researches and honours status + query filters', async () => {
    const all = await request(app).get('/researches');
    expect(all.status).toBe(200);
    expect(all.text).toContain('Survey what the CodeGraph tree-sitter database exposes');

    const completed = await request(app).get('/researches?status=completed');
    expect(completed.text).toContain('Survey what the CodeGraph tree-sitter database exposes');

    const inProgress = await request(app).get('/researches?status=in_progress');
    expect(inProgress.text).not.toContain('Survey what the CodeGraph tree-sitter database exposes');
    expect(inProgress.text).toContain('Nothing matches');

    const searched = await request(app).get('/researches?q=dddsample');
    expect(searched.text).toContain('Survey what the CodeGraph tree-sitter database exposes');

    const noMatch = await request(app).get('/researches?q=definitely-absent-term');
    expect(noMatch.text).toContain('Nothing matches');

    // Unknown status values are ignored rather than erroring.
    const bogus = await request(app).get('/researches?status=nonsense');
    expect(bogus.status).toBe(200);
  });

  it('renders a research detail with linked activities and runs', async () => {
    const res = await request(app).get(`/research/${RESEARCH_ID}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Survey what the CodeGraph tree-sitter database exposes');
    expect(res.text).toContain('01-codegraph-db-survey');
    expect(res.text).toContain(RUN_ID);
    expect(res.text).toContain('codegraph, tree-sitter');
  });

  it('404s for a missing research', async () => {
    const res = await request(app).get('/research/res_nope');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Research activity not found');
  });

  it('lists activities and honours scope filter', async () => {
    const all = await request(app).get('/activities');
    expect(all.status).toBe(200);
    expect(all.text).toContain('Built and ran research script 01-codegraph-db-survey');
    expect(all.text).toContain('Added a Git Workflow rule to CLAUDE.md');

    const code = await request(app).get('/activities?scope=code');
    expect(code.text).toContain('Added a Git Workflow rule to CLAUDE.md');
    expect(code.text).not.toContain('Built and ran research script 01-codegraph-db-survey');

    const research = await request(app).get('/activities?scope=research');
    expect(research.text).toContain('Built and ran research script 01-codegraph-db-survey');
    expect(research.text).not.toContain('Added a Git Workflow rule to CLAUDE.md');

    const searched = await request(app).get('/activities?q=never-push-to-main');
    expect(searched.text).toContain('Opened PR #1');
  });

  it('lists test runs and honours status filter', async () => {
    const all = await request(app).get('/runs');
    expect(all.status).toBe(200);
    expect(all.text).toContain('pnpm test (worktree research/codegraph-db-survey)');

    const failed = await request(app).get('/runs?status=failed');
    expect(failed.text).not.toContain(RUN_ID);
    expect(failed.text).toContain('No test runs yet');
  });

  it('renders a run detail', async () => {
    const res = await request(app).get(`/runs/${RUN_ID}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('All suites green');
    expect(res.text).toContain('No per-test report published');
    expect(res.text).toContain('No run-level output captured');
    expect(res.text).toContain(RESEARCH_ID);
  });

  it('visualizes a per-test report grouped by file', async () => {
    const run = publishTestResults(testDb.db, {
      suite: 'pnpm test',
      durationMs: 2100,
      tests: [
        { name: 'suite > fast one', status: 'passed', file: 'test/a.test.ts', durationMs: 4 },
        {
          name: 'suite > broken one',
          status: 'failed',
          file: 'test/b.test.ts',
          durationMs: 90,
          error: 'AssertionError: expected <thing> to exist',
          logs: 'console.log: state before failure',
        },
        { name: 'suite > later one', status: 'skipped', file: 'test/b.test.ts' },
      ],
    });
    const res = await request(app).get(`/runs/${run.id}`);
    expect(res.status).toBe(200);
    // File grouping with per-file summaries.
    expect(res.text).toContain('test/a.test.ts');
    expect(res.text).toContain('2 tests · 1 failed');
    // Every test name, with its status marker.
    expect(res.text).toContain('suite &gt; fast one');
    expect(res.text).toContain('dot--passed');
    expect(res.text).toContain('dot--failed');
    expect(res.text).toContain('dot--skipped');
    // Failure detail and per-test console output, escaped.
    expect(res.text).toContain('AssertionError: expected &lt;thing&gt; to exist');
    expect(res.text).toContain('console output');
    expect(res.text).toContain('console.log: state before failure');
    // Proportion bar.
    expect(res.text).toContain('bar__failed');
  });

  it('renders a run detail with escaped output', async () => {
    const run = publishTestResults(testDb.db, {
      suite: 'vitest',
      passed: 1,
      failed: 1,
      output: 'FAIL test/x.test.ts\n  expected <a> to be <b>',
    });
    const res = await request(app).get(`/runs/${run.id}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('FAIL test/x.test.ts');
    expect(res.text).toContain('expected &lt;a&gt; to be &lt;b&gt;');
  });

  it('404s for a missing run', async () => {
    const res = await request(app).get('/runs/run_nope');
    expect(res.status).toBe(404);
  });

  it('renders the progress journal', async () => {
    const res = await request(app).get('/progress');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Progress journal');
    expect(res.text).toContain('prog_d-eIV8tKfidvLWUdGWm1i');
    expect(res.text).toContain('prog_ES1W0vG32kmXBfPpTPenH');
  });

  it('404s for unknown paths', async () => {
    const res = await request(app).get('/definitely-not-a-page');
    expect(res.status).toBe(404);
    expect(res.text).toContain('No such page');
  });
});

describe('render helpers', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;',
    );
  });

  it('escapes markup coming from the database', async () => {
    const testDb = createTestDatabase();
    try {
      const { logResearch } = await import('../../src/tools/research.js');
      logResearch(testDb.db, {
        title: '<img src=x onerror=alert(1)>',
        goal: 'xss check',
      });
      const res = await request(createUiApp(testDb.db)).get('/researches');
      expect(res.text).not.toContain('<img src=x');
      expect(res.text).toContain('&lt;img src=x');
    } finally {
      disposeTestDatabase(testDb);
    }
  });

  it('formats relative times', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    expect(timeAgo('2026-01-15T11:59:59.000Z', now)).toBe('just now');
    expect(timeAgo('2026-01-15T11:30:00.000Z', now)).toBe('30m ago');
    expect(timeAgo('2026-01-15T02:00:00.000Z', now)).toBe('10h ago');
    expect(timeAgo('2026-01-05T12:00:00.000Z', now)).toBe('10d ago');
  });
});
