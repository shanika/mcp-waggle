# Waggle (`mcp-waggle`)

An MCP server for planning and overseeing a software project from the outside. It gives coding
agents a persistent, queryable place to:

- **Log research activities** — what is being investigated, why, and what came of it
- **Publish test results** — one record per test run, optionally linked to a research activity
- **Write and read overall project progress** — an append-only journal of where the project stands

Waggle owns its own SQLite database and knows nothing about the project it tracks; the tracked
project registers Waggle as just another MCP server. (Named after the waggle dance — how bees
report their findings back to the hive. Sibling of [mcp-bumble](https://github.com/shanika/mcp-bumble),
whose architecture it follows.)

## Tools

| Tool | Purpose |
| --- | --- |
| `log_research` | Record a research activity with its goal (optionally results/status/tags) |
| `update_research` | Update a research activity's results and/or status |
| `list_research` | List activities, newest first; filter by status or free-text query |
| `get_research` | Fetch one activity, including its linked test runs |
| `publish_test_results` | Record a test run (suite + pass/fail/skip counts; status and total derived) |
| `list_test_runs` | List runs, newest first; filter by suite/status |
| `get_test_run` | Fetch one run including its full output |
| `write_progress` | Append a project progress entry (summary + optional details) |
| `read_progress` | Read the latest progress entry plus recent history |

## Setup

```bash
npm ci
npm run build      # bundles to dist/ and copies migrations
node scripts/smoke.mjs   # end-to-end STDIO smoke test of the built server
```

Register with an MCP client (Claude Code `.mcp.json` / Claude Desktop config):

```json
{
  "mcpServers": {
    "waggle": {
      "command": "node",
      "args": ["/path/to/mcp-waggle/dist/index.js"]
    }
  }
}
```

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `DB_PATH` | `~/.waggle/waggle.db` | SQLite database file (created + migrated on startup) |

`node dist/index.js migrate` applies migrations and exits (they also run automatically on server
startup).

## Development

- **Stack:** TypeScript, Node ≥ 20, `@modelcontextprotocol/sdk` (STDIO), SQLite via
  `better-sqlite3`, Drizzle ORM with committed migrations, `tsup`, Vitest, ESLint.
- **Layout:** `src/index.ts` (entry/dispatch) → `src/server.ts` (tool registration) →
  `src/tools/*` (one file per tool group, pure functions + thin MCP wrappers) → `src/db/*`
  (schema, connection + migration runner) → `src/lib/ids.ts` (nanoid prefix helpers:
  `res_`, `run_`, `prog_`).

```bash
npm test               # all Vitest suites (fresh in-memory SQLite per test)
npm run test:coverage  # v8 coverage, 80% thresholds enforced
npm run lint
npm run typecheck
npm run db:generate    # regenerate migrations after editing src/db/schema.ts
```
