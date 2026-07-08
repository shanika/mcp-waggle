import type { ProgressEntry, TestCaseResult, TestRun } from '../db/schema.js';
import type { ActivityView } from '../tools/activities.js';
import type { ResearchView } from '../tools/research.js';
import type { TestRunView } from '../tools/tests.js';

type TestRunRow = Omit<TestRun, 'report'>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const esc = escapeHtml;

export function timeAgo(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function when(iso: string): string {
  return `<time class="when" datetime="${esc(iso)}" title="${esc(iso)}">${esc(timeAgo(iso))}</time>`;
}

function statusPill(status: string): string {
  return `<span class="pill pill--${esc(status)}">${esc(status.replace('_', ' '))}</span>`;
}

// Tecture Blueprint Design System — tokens sourced from tecture-www
// src/styles/tokens.css (REV 1.1) / tecture-io packages/web/src/styles.css.
// Fonts come from the Google Fonts CDN like tecture.io itself; the ui-* stacks
// keep the dashboard readable offline.
const STYLES = `
@import url("https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;700;800&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap");
:root {
  --bg-deep: #0a0f1a;
  --bg-surface: #0f1628;
  --bg-elevated: #141d33;
  --border-default: #1e2d4a;
  --grid-line: #1a2744;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent-cyan: #22d3ee;
  --accent-amber: #f59e0b;
  --accent-emerald: #34d399;
  --accent-red: #f87171;
  --on-cyan: #04222b;
  --font-display: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0; color: var(--text-secondary);
  font: 400 15.5px/1.62 var(--font-sans);
  -webkit-font-smoothing: antialiased;
  /* Signature blueprint grid: 100px major / 20px minor. */
  background-color: var(--bg-deep);
  background-image:
    linear-gradient(rgba(34, 78, 130, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 78, 130, 0.18) 1px, transparent 1px),
    linear-gradient(rgba(34, 78, 130, 0.08) 0.5px, transparent 0.5px),
    linear-gradient(90deg, rgba(34, 78, 130, 0.08) 0.5px, transparent 0.5px);
  background-size: 100px 100px, 100px 100px, 20px 20px, 20px 20px;
}
a { color: var(--accent-cyan); text-decoration: none; }
a:hover { text-decoration: underline; }
header {
  display: flex; align-items: baseline; gap: 2rem; flex-wrap: wrap;
  padding: 1rem 2rem; border-bottom: 1px solid var(--border-default);
  background: rgba(10, 15, 26, 0.92);
}
.logo {
  font-family: var(--font-display); font-weight: 800; font-size: 1.25rem;
  letter-spacing: -0.03em; color: var(--text-primary);
}
.logo .hex { color: var(--accent-cyan); margin-right: 0.4rem; }
nav { display: flex; gap: 1.4rem; }
nav a { font: 600 13px var(--font-sans); color: var(--text-muted); }
nav a.active, nav a:hover { color: var(--accent-cyan); text-decoration: none; }
main { max-width: 62rem; margin: 0 auto; padding: 2rem; }
h1 {
  font-family: var(--font-display); font-weight: 800; font-size: 30px;
  letter-spacing: -0.03em; line-height: 1.1; color: var(--text-primary);
  margin: 0 0 1.2rem;
}
/* Section headers use the signature annotation device:
   mono, uppercase, wide tracking, cyan. */
h2 {
  font-family: var(--font-mono); font-weight: 500; font-size: 11px;
  letter-spacing: 0.3em; text-transform: uppercase; color: var(--accent-cyan);
  margin: 2.4rem 0 0.8rem;
}
h2:first-of-type { margin-top: 0; }
.card {
  background: var(--bg-surface); border: 1px solid var(--border-default);
  padding: 1rem 1.2rem; margin-bottom: 0.6rem;
}
.card .title { font-weight: 600; color: var(--text-primary); }
.meta { color: var(--text-muted); font-size: 13px; margin-top: 0.2rem; }
.meta .id { font-family: var(--font-mono); font-size: 12px; }
.when { color: var(--text-muted); }
.pill {
  display: inline-block; font-family: var(--font-mono); font-weight: 500;
  font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
  border-radius: 9999px; padding: 0.15rem 0.65rem;
  border: 1px solid currentColor; margin-left: 0.5rem;
}
.pill--in_progress { color: var(--accent-amber); }
.pill--completed, .pill--passed { color: var(--accent-emerald); }
.pill--abandoned { color: var(--text-muted); }
.pill--failed { color: var(--accent-red); }
.pill--code { color: var(--text-muted); }
.pill--research { color: var(--accent-cyan); }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th {
  font-family: var(--font-mono); font-weight: 500; font-size: 10px;
  letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted);
  text-align: left; padding: 0.4rem 0.8rem 0.4rem 0;
}
td { padding: 0.45rem 0.8rem 0.45rem 0; border-top: 1px solid var(--border-default); }
td.num { font-family: var(--font-mono); font-size: 12.5px; }
.filters { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.2rem; }
.filters a {
  font-family: var(--font-mono); font-weight: 500; font-size: 11px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted);
  border: 1px solid var(--border-default); padding: 0.25rem 0.8rem;
}
.filters a.active {
  color: var(--on-cyan); background: var(--accent-cyan); border-color: var(--accent-cyan);
}
.filters a:hover { text-decoration: none; color: var(--accent-cyan); }
.filters input {
  background: var(--bg-surface); border: 1px solid var(--border-default);
  color: var(--text-primary); font: 400 13px var(--font-sans); padding: 0.25rem 0.8rem;
}
.filters input:focus { outline: 1px solid var(--accent-cyan); outline-offset: -1px; }
pre {
  background: var(--bg-elevated); border: 1px solid var(--border-default);
  padding: 1rem; font: 400 13px/1.6 var(--font-mono); color: var(--text-primary);
  overflow-x: auto; white-space: pre-wrap;
}
.stats { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.6rem; }
.stat {
  flex: 1 1 8rem; background: var(--bg-surface);
  border: 1px solid var(--border-default); padding: 0.8rem 1rem;
}
.stat b { display: block; font: 600 24px var(--font-mono); color: var(--accent-cyan); }
.stat span {
  font-family: var(--font-mono); font-weight: 500; font-size: 10px;
  letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted);
}
.bar {
  display: flex; height: 6px; overflow: hidden; margin-bottom: 1rem;
  background: var(--bg-elevated); border: 1px solid var(--border-default);
}
td .bar { margin: 0; width: 7rem; }
.bar__passed { background: var(--accent-emerald); }
.bar__failed { background: var(--accent-red); }
.bar__skipped { background: var(--text-muted); }
.filegroup {
  background: var(--bg-surface); border: 1px solid var(--border-default);
  padding: 0.6rem 1rem 0.7rem; margin-bottom: 0.6rem;
}
.testfile {
  display: flex; justify-content: space-between; align-items: baseline; gap: 1rem;
  padding-bottom: 0.4rem; margin-bottom: 0.3rem;
  border-bottom: 1px solid var(--border-default);
}
.testfile .id { color: var(--accent-cyan); }
.test { display: flex; align-items: baseline; gap: 0.6rem; padding: 0.22rem 0; font-size: 14px; }
.tname { color: var(--text-primary); flex: 1; }
.test--skipped .tname { color: var(--text-muted); text-decoration: line-through; }
.dot {
  flex: none; width: 8px; height: 8px; border-radius: 9999px;
  position: relative; top: -1px;
}
.dot--passed { background: var(--accent-emerald); }
.dot--failed { background: var(--accent-red); box-shadow: 0 0 6px rgba(248, 113, 113, 0.5); }
.dot--skipped { background: none; border: 1px solid var(--text-muted); }
.tdur {
  display: flex; align-items: center; gap: 0.4rem; flex: none;
  font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);
}
.durbar { display: inline-block; height: 4px; background: var(--grid-line); border-right: 2px solid var(--accent-cyan); }
.terror { margin: 0.2rem 0 0.5rem 1.15rem; border-left: 2px solid var(--accent-red); }
.tlogs { margin: 0.1rem 0 0.5rem 1.15rem; }
.tlogs summary {
  cursor: pointer; font-family: var(--font-mono); font-size: 11px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted);
}
.tlogs summary:hover { color: var(--accent-cyan); }
.tlogs pre { margin-top: 0.3rem; }
.empty { color: var(--text-muted); font-style: italic; padding: 0.6rem 0; }
.crumb { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); margin-bottom: 0.4rem; }
.prose { white-space: pre-wrap; }
footer {
  text-align: center; padding: 2rem 0 1.5rem;
  font-family: var(--font-mono); font-weight: 500; font-size: 10px;
  letter-spacing: 0.3em; text-transform: uppercase; color: var(--text-muted);
}
@keyframes fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
main { animation: fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
@media (prefers-reduced-motion: reduce) { main { animation: none; } }
`;

const NAV = [
  ['/', 'Overview'],
  ['/researches', 'Researches'],
  ['/activities', 'Activities'],
  ['/runs', 'Test runs'],
  ['/progress', 'Progress'],
] as const;

export function layout(title: string, activePath: string, body: string): string {
  const links = NAV.map(
    ([href, label]) =>
      `<a href="${href}"${href === activePath ? ' class="active"' : ''}>${label}</a>`,
  ).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Waggle</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 1 21.5 6.5v11L12 23 2.5 17.5v-11z' fill='%2322d3ee'/%3E%3C/svg%3E">
<style>${STYLES}</style>
</head>
<body>
<header><span class="logo"><span class="hex">⬢</span>Waggle</span><nav>${links}</nav></header>
<main>${body}</main>
<footer>waggle — the hive ledger for tecture-graph</footer>
</body>
</html>`;
}

function researchCard(r: ResearchView): string {
  const tags = r.tags.length
    ? `<span class="meta"> · ${r.tags.map((t) => esc(t)).join(', ')}</span>`
    : '';
  return `<div class="card">
    <div class="title"><a href="/research/${esc(r.id)}">${esc(r.title)}</a>${statusPill(r.status)}</div>
    <div class="meta">${esc(r.goal)}</div>
    <div class="meta"><span class="id">${esc(r.id)}</span> · updated ${when(r.updatedAt)}${tags}</div>
  </div>`;
}

function activityCard(a: ActivityView): string {
  const link = a.researchId
    ? ` · <a href="/research/${esc(a.researchId)}"><span class="id">${esc(a.researchId)}</span></a>`
    : '';
  return `<div class="card">
    <div class="title">${esc(a.activity)}${statusPill(a.scope)}</div>
    ${a.details ? `<div class="meta">${esc(a.details)}</div>` : ''}
    <div class="meta">${when(a.createdAt)}${link}</div>
  </div>`;
}

/** Stacked passed/failed/skipped proportion bar. */
function resultBar(passed: number, failed: number, skipped: number): string {
  const total = passed + failed + skipped;
  if (total === 0) return '';
  const seg = (n: number, kind: string): string =>
    n > 0 ? `<span class="bar__${kind}" style="width:${((n / total) * 100).toFixed(2)}%"></span>` : '';
  return `<div class="bar" title="${passed} passed · ${failed} failed · ${skipped} skipped">${seg(passed, 'passed')}${seg(failed, 'failed')}${seg(skipped, 'skipped')}</div>`;
}

function runsTable(runs: TestRunRow[]): string {
  if (runs.length === 0) return `<div class="empty">No test runs yet.</div>`;
  const rows = runs
    .map(
      (r) => `<tr>
      <td><a href="/runs/${esc(r.id)}">${esc(r.suite)}</a></td>
      <td>${statusPill(r.status)}</td>
      <td class="num">${r.passed}/${r.total}${r.failed ? ` · ${r.failed} failed` : ''}</td>
      <td>${resultBar(r.passed, r.failed, r.skipped)}</td>
      <td class="num">${r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'}</td>
      <td>${when(r.ranAt)}</td>
    </tr>`,
    )
    .join('');
  return `<table><thead><tr><th>Suite</th><th>Status</th><th>Passed</th><th></th><th>Duration</th><th>Ran</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function progressCard(p: ProgressEntry): string {
  return `<div class="card">
    <div class="title prose">${esc(p.summary)}</div>
    ${p.details ? `<div class="meta prose">${esc(p.details)}</div>` : ''}
    <div class="meta"><span class="id">${esc(p.id)}</span> · ${when(p.createdAt)}</div>
  </div>`;
}

function section<T>(items: T[], render: (item: T) => string, emptyText: string): string {
  return items.length === 0 ? `<div class="empty">${esc(emptyText)}</div>` : items.map(render).join('');
}

export interface OverviewData {
  latestProgress: ProgressEntry | null;
  researches: ResearchView[];
  activities: ActivityView[];
  runs: TestRunRow[];
  counts: { researches: number; activities: number; runs: number };
}

export function renderOverview(data: OverviewData): string {
  const body = `<h1>Overview</h1>
  <div class="stats">
    <div class="stat"><b>${data.counts.researches}</b><span>researches</span></div>
    <div class="stat"><b>${data.counts.activities}</b><span>activities</span></div>
    <div class="stat"><b>${data.counts.runs}</b><span>test runs</span></div>
  </div>
  <h2>Latest progress</h2>
  ${data.latestProgress ? progressCard(data.latestProgress) : '<div class="empty">No progress written yet.</div>'}
  <h2>Recent researches</h2>
  ${section(data.researches, researchCard, 'No researches logged yet.')}
  <h2>Recent activities</h2>
  ${section(data.activities, activityCard, 'No activities logged yet.')}
  <h2>Recent test runs</h2>
  ${runsTable(data.runs)}`;
  return layout('Overview', '/', body);
}

function filterBar(
  basePath: string,
  current: string | undefined,
  values: readonly string[],
  query?: string,
): string {
  const link = (label: string, value?: string): string => {
    const params = new URLSearchParams();
    if (value) params.set('status', value);
    if (query) params.set('q', query);
    const qs = params.toString();
    const active = (value ?? '') === (current ?? '');
    return `<a href="${basePath}${qs ? `?${qs}` : ''}"${active ? ' class="active"' : ''}>${esc(label)}</a>`;
  };
  const search = `<form action="${basePath}" method="get">
    ${current ? `<input type="hidden" name="status" value="${esc(current)}">` : ''}
    <input type="search" name="q" value="${esc(query ?? '')}" placeholder="search…">
  </form>`;
  return `<div class="filters">${link('All')}${values.map((v) => link(v.replace('_', ' '), v)).join('')}${search}</div>`;
}

export function renderResearchList(
  researches: ResearchView[],
  statuses: readonly string[],
  status?: string,
  query?: string,
): string {
  const body = `<h1>Researches</h1>
  ${filterBar('/researches', status, statuses, query)}
  ${section(researches, researchCard, 'Nothing matches.')}`;
  return layout('Researches', '/researches', body);
}

export function renderResearchDetail(
  research: ResearchView & { testRuns: TestRunRow[]; activities: ActivityView[] },
): string {
  const body = `<div class="crumb"><a href="/researches">researches</a> / <span class="id">${esc(research.id)}</span></div>
  <h1>${esc(research.title)} ${statusPill(research.status)}</h1>
  <div class="card">
    <div class="meta"><b>Goal</b></div><div class="prose">${esc(research.goal)}</div>
    ${research.results ? `<div class="meta" style="margin-top:0.8rem"><b>Results</b></div><div class="prose">${esc(research.results)}</div>` : ''}
    <div class="meta" style="margin-top:0.8rem">created ${when(research.createdAt)} · updated ${when(research.updatedAt)}${research.tags.length ? ` · ${research.tags.map(esc).join(', ')}` : ''}</div>
  </div>
  <h2>Activities</h2>
  ${section(research.activities, activityCard, 'No activities linked to this research.')}
  <h2>Test runs</h2>
  ${runsTable(research.testRuns)}`;
  return layout(research.title, '/researches', body);
}

export function renderActivityList(
  items: ActivityView[],
  scope?: string,
  query?: string,
): string {
  const link = (label: string, value?: string): string => {
    const params = new URLSearchParams();
    if (value) params.set('scope', value);
    if (query) params.set('q', query);
    const qs = params.toString();
    const active = (value ?? '') === (scope ?? '');
    return `<a href="/activities${qs ? `?${qs}` : ''}"${active ? ' class="active"' : ''}>${esc(label)}</a>`;
  };
  const body = `<h1>Activities</h1>
  <div class="filters">${link('All')}${link('research', 'research')}${link('code', 'code')}
    <form action="/activities" method="get">
      ${scope ? `<input type="hidden" name="scope" value="${esc(scope)}">` : ''}
      <input type="search" name="q" value="${esc(query ?? '')}" placeholder="search…">
    </form>
  </div>
  ${section(items, activityCard, 'Nothing matches.')}`;
  return layout('Activities', '/activities', body);
}

export function renderRunList(
  runs: TestRunRow[],
  statuses: readonly string[],
  status?: string,
): string {
  const body = `<h1>Test runs</h1>
  ${filterBar('/runs', status, statuses)}
  ${runsTable(runs)}`;
  return layout('Test runs', '/runs', body);
}

function testCaseRow(test: TestCaseResult, maxDurationMs: number): string {
  const duration =
    test.durationMs != null
      ? `<span class="tdur"><span class="durbar" style="width:${Math.max(2, (test.durationMs / Math.max(1, maxDurationMs)) * 60).toFixed(1)}px"></span>${test.durationMs}ms</span>`
      : '';
  const error = test.error
    ? `<pre class="terror">${esc(test.error)}</pre>`
    : '';
  const logs = test.logs
    ? `<details class="tlogs"><summary>console output</summary><pre>${esc(test.logs)}</pre></details>`
    : '';
  return `<div class="test test--${esc(test.status)}">
    <span class="dot dot--${esc(test.status)}" title="${esc(test.status)}"></span>
    <span class="tname">${esc(test.name)}</span>
    ${duration}
  </div>${error}${logs}`;
}

function testReport(tests: TestCaseResult[]): string {
  const maxDurationMs = Math.max(...tests.map((t) => t.durationMs ?? 0));
  // Group by file, preserving the order files first appear in the report.
  const byFile = new Map<string, TestCaseResult[]>();
  for (const test of tests) {
    const key = test.file ?? '';
    byFile.set(key, [...(byFile.get(key) ?? []), test]);
  }
  return [...byFile.entries()]
    .map(([file, fileTests]) => {
      const failed = fileTests.filter((t) => t.status === 'failed').length;
      const fileDuration = fileTests.reduce((ms, t) => ms + (t.durationMs ?? 0), 0);
      const header = file
        ? `<div class="testfile"><span class="id">${esc(file)}</span><span class="meta">${fileTests.length} tests${failed ? ` · ${failed} failed` : ''}${fileDuration ? ` · ${fileDuration}ms` : ''}</span></div>`
        : '';
      return `<div class="filegroup">${header}${fileTests.map((t) => testCaseRow(t, maxDurationMs)).join('')}</div>`;
    })
    .join('');
}

export function renderRunDetail(run: TestRunView): string {
  const research = run.researchId
    ? ` · research <a href="/research/${esc(run.researchId)}"><span class="id">${esc(run.researchId)}</span></a>`
    : '';
  const body = `<div class="crumb"><a href="/runs">test runs</a> / <span class="id">${esc(run.id)}</span></div>
  <h1>${esc(run.suite)} ${statusPill(run.status)}</h1>
  <div class="stats">
    <div class="stat"><b>${run.passed}</b><span>passed</span></div>
    <div class="stat"><b>${run.failed}</b><span>failed</span></div>
    <div class="stat"><b>${run.skipped}</b><span>skipped</span></div>
    <div class="stat"><b>${run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}</b><span>duration</span></div>
  </div>
  ${resultBar(run.passed, run.failed, run.skipped)}
  <div class="card">
    ${run.summary ? `<div class="title">${esc(run.summary)}</div>` : ''}
    <div class="meta">ran ${when(run.ranAt)}${research}</div>
  </div>
  <h2>Report</h2>
  ${
    run.tests && run.tests.length > 0
      ? testReport(run.tests)
      : '<div class="empty">No per-test report published for this run.</div>'
  }
  <h2>Output</h2>
  ${run.output ? `<pre>${esc(run.output)}</pre>` : '<div class="empty">No run-level output captured.</div>'}`;
  return layout(run.suite, '/runs', body);
}

export function renderProgress(history: ProgressEntry[]): string {
  const body = `<h1>Progress journal</h1>
  ${section(history, progressCard, 'No progress written yet.')}`;
  return layout('Progress', '/progress', body);
}

export function renderNotFound(message: string): string {
  const body = `<h1>Not found</h1><div class="card"><div class="prose">${esc(message)}</div></div>`;
  return layout('Not found', '', body);
}
