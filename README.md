# Waggle (`mcp-waggle`)

An MCP server for planning and overseeing the **tecture-graph** project from the outside. It gives
coding agents a persistent, queryable place to:

- **Log tecture-graph researches** — what is being investigated, why, and what came of it
- **Log development activities** — each step performed, linked to a research or directly on the code
- **Publish test results** — one record per test run, optionally linked to a research
- **Write and read overall project progress** — an append-only journal of where the project stands

Waggle owns its own SQLite database and knows nothing about the project it tracks; the tracked
project registers Waggle as just another MCP server. (Named after the waggle dance — how bees
report their findings back to the hive. Sibling of [mcp-bumble](https://github.com/shanika/mcp-bumble),
whose architecture — including the OAuth 2.1 HTTP transport — it follows.)

## Tools

| Tool | Purpose |
| --- | --- |
| `log_tecture_research` | Record a tecture-graph research with its goal (optionally results/status/tags) |
| `update_tecture_research` | Update a research's results and/or status |
| `list_tecture_researches` | List researches, newest first; filter by status or free-text query |
| `get_tecture_research` | Fetch one research, including linked test runs + activities |
| `log_activity` | Record a development activity — research-linked (`researchId`) or direct code work |
| `list_activities` | List activities; filter by researchId, scope (`research`/`code`), or query |
| `publish_test_results` | Record a test run with its full per-test report (`tests[]`: name, file, status, duration, error, console logs — counts and status derived); bare counts only as a fallback |
| `list_test_runs` | List runs, newest first, without per-test reports; filter by suite/status |
| `get_test_run` | Fetch one run including its full per-test report and run-level output |
| `write_progress` | Append a project progress entry (summary + optional details) |
| `read_progress` | Read the latest progress entry plus recent history |

The research tools carry the `tecture_` prefix deliberately, so they don't collide with other
research-log connectors in the same Claude workspace.

### Publishing full Vitest reports (with per-test console logs)

Vitest's built-in JSON reporter (`--reporter=json`) includes per-test names, statuses, durations
and failure messages — but **no console output**. To capture logs per test, use the bundled
custom reporter, which listens to `onUserConsoleLog` (its `taskId` matches `TestCase.id`) and
writes a payload that can be passed to `publish_test_results` verbatim:

```bash
npm run test:report   # = vitest run --reporter=default --reporter=./scripts/vitest-waggle-reporter.mjs
# → waggle-report.json: { suite, durationMs, tests: [{ name, file, status, durationMs, error?, logs? }] }
```

`WAGGLE_SUITE` and `WAGGLE_REPORT_FILE` override the suite name and output path. The reporter is
self-contained — copy `scripts/vitest-waggle-reporter.mjs` into any Vitest project that publishes
to Waggle.

## Dashboard

A read-only web interface over the same database — browse researches, activities, test runs and
the progress journal without going through MCP:

```bash
OAUTH_ADMIN_PASSWORD=... npm run ui          # http://127.0.0.1:3204
```

It is protected by the same admin password as the MCP server (`OAUTH_ADMIN_PASSWORD`, the one
the OAuth consent page uses) and refuses to start without it. Logging in sets an HttpOnly
session cookie (7 days, kept in memory — a restart signs everyone out). The dashboard never
mutates data.

In HTTP mode (`WAGGLE_TRANSPORT=http`) the dashboard is also served from the MCP server's own
origin — every path the MCP/OAuth routes don't claim — so the hosted instance's dashboard lives
at https://waggle.heycasper.uk/ behind the same login. No separate process or port needed.

| Env var | Default | Purpose |
| --- | --- | --- |
| `OAUTH_ADMIN_PASSWORD` | — (required) | Same password that gates the OAuth consent page |
| `WAGGLE_UI_PORT` | `3204` | Dashboard port |
| `WAGGLE_UI_HOST` | `127.0.0.1` | Bind host |
| `DB_PATH` | `~/.waggle/waggle.db` | Same database the MCP server uses |

## Transports

**STDIO (default)** — for local Claude Code / Claude Desktop:

```json
{
  "mcpServers": {
    "waggle": { "command": "node", "args": ["/path/to/mcp-waggle/dist/index.js"] }
  }
}
```

**HTTP + OAuth 2.1 (`WAGGLE_TRANSPORT=http`)** — for use as a claude.ai custom connector.
Streamable HTTP at `/mcp`, OAuth 2.1 with dynamic client registration, PKCE, a password-gated
consent page, opaque 15-minute access tokens and rotated 90-day refresh tokens (stored hashed in
a JSON file), and RFC 8707 resource binding. Same design as mcp-bumble v1.1.

| Env var | Default | Purpose |
| --- | --- | --- |
| `DB_PATH` | `~/.waggle/waggle.db` | SQLite database file (created + migrated on startup) |
| `WAGGLE_TRANSPORT` | `stdio` | Set to `http` for the hosted mode |
| `OAUTH_ISSUER` | — (required for http) | Canonical public URL, e.g. `https://waggle.heycasper.uk` |
| `OAUTH_ADMIN_PASSWORD` | — (required for http) | Password for the consent page |
| `OAUTH_DATA_FILE` | in-memory | JSON file for OAuth clients/tokens |
| `WAGGLE_HTTP_PORT` | `3203` | Local port to bind |
| `WAGGLE_HTTP_HOST` | `127.0.0.1` | Bind host |
| `WAGGLE_HTTP_ALLOWED_HOSTS` | — | Allowed `Host` headers (DNS-rebinding protection) |

## Setup

```bash
npm ci
npm run build       # bundles to dist/ and copies migrations
npm run smoke       # end-to-end STDIO smoke test of the built server
```

`node dist/index.js migrate` applies migrations and exits (they also run automatically on
startup).

## Deploy

The hosted instance runs on the Raspberry Pi as `mcp-waggle.service` (checkout at
`/home/pi/mcp-waggle`, config in `/etc/mcp-waggle.env`, deployed from `origin/main`):

```bash
npm run deploy      # = ./scripts/deploy-pi.sh
```

The script verifies the local tree is clean and pushed, runs the test suite (skip with
`SKIP_TESTS=1`), then over SSH: syncs the Pi checkout to `origin/main`, `npm ci`, builds,
restarts the service, and health-checks it locally and via https://waggle.heycasper.uk.
Override `PI_HOST`, `PI_DIR`, `SERVICE`, `BRANCH`, or `PUBLIC_URL` via env if the setup moves. `npm run db:seed` (= `node dist/index.js seed`) inserts a snapshot of real
tecture-graph tracking data (captured 2026-07-09 from the live Waggle instance: the CodeGraph
DB-survey research with its linked activities and test run, plus the progress journal) into
`DB_PATH`; it is idempotent, so re-running never duplicates rows.

## Development

- **Stack:** TypeScript, Node ≥ 20, `@modelcontextprotocol/sdk`, Express 5 (HTTP transport),
  SQLite via `better-sqlite3`, Drizzle ORM with committed migrations, `tsup`, Vitest, ESLint.
- **Layout:** `src/index.ts` (entry/dispatch) → `src/transport/{stdio,http}.ts` →
  `src/server.ts` (tool registration) → `src/tools/*` (pure functions + thin MCP wrappers) →
  `src/oauth/*` (provider, JSON-file token store, consent page) → `src/ui/*` (read-only local
  dashboard: Express routes + server-rendered HTML) → `src/db/*` (schema, connection + migration
  runner, seed fixtures) → `src/lib/ids.ts` (nanoid prefixes: `res_`, `act_`, `run_`, `prog_`).

```bash
npm test               # all Vitest suites (fresh in-memory SQLite per test)
npm run test:coverage  # v8 coverage, 80% thresholds enforced
npm run lint
npm run typecheck
npm run db:generate    # regenerate migrations after editing src/db/schema.ts
```
