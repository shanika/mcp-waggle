import { activities, progressEntries, researchActivities, testRuns } from './schema.js';
import type { WaggleDatabase } from './index.js';

export interface SeedResult {
  researches: number;
  activities: number;
  testRuns: number;
  progressEntries: number;
}

/**
 * Inserts a snapshot of real project data, captured 2026-07-09 from the live
 * Waggle instance tracking tecture-graph (ids and timestamps verbatim).
 * Idempotent — existing rows are left untouched.
 */
export function seedDatabase(db: WaggleDatabase): SeedResult {
  const researchRows = [
    {
      id: 'res_CmR_jwPkQ-8WiaSJH0xxj',
      title: 'Survey what the CodeGraph tree-sitter database exposes for architecture analysis',
      goal: "Question: after running CodeGraph indexing over a target repo, what data can be read directly from its SQLite database (.codegraph/codegraph.db) that is useful for tecture-graph's C4 container/component analysis — in particular, can we determine the repo's language(s) and find evidence of the framework used (e.g. Spring for dddsample-core)? Validation: a research script (scripts/research/) copies the dddsample-core fixture to a scratch dir (fixtures stay read-only), runs `codegraph init` on it, queries the DB with node:sqlite, and writes a machine-readable JSON report (tables, files-by-language, node kinds, edge kinds, unresolved refs, annotation/import-based framework evidence). A Vitest test asserts on the report: Java is the dominant language, class/method nodes and call/import edges exist, and Spring evidence (org.springframework refs or Spring annotations) is present. Confirmed if language + framework evidence are reliably extractable; refuted for any signal that turns out not to be present in the DB.",
      status: 'completed',
      results:
        'CONFIRMED — language and framework are both readable straight from the CodeGraph SQLite DB. PR: https://github.com/shanika/tecture-graph/pull/2\n\nSurvey of dddsample-core (159 files, 2,768 nodes, 5,812 edges; full index ~4s, deterministic across fresh re-runs):\n\n1. LANGUAGE: trivial — files.language column (java 145, xml 5, yaml 5, properties 2, javascript 2). Primary language = max count. Config formats (xml/yaml/properties) are indexed as files too.\n2. FRAMEWORK: two strong signals. (a) \'import\' nodes store full qualified import paths — org.springframework.* appears 164×, so namespace-prefix counting identifies the framework deterministically. (b) CodeGraph synthesizes \'route\' nodes from Spring MVC controller annotations ("POST /admin/register" etc., 12 found) — a ready-made API-surface/framework signal.\n3. C4-RELEVANT STRUCTURE: \'namespace\' nodes give the Java package per file (raw material for component clustering); edges cover contains (2584), calls (1287), references (934), instantiates (507), imports (470), implements (16), extends (12), decorates (2), each with confidence metadata JSON. FTS5 index (nodes_fts) available for search.\n4. GAPS: (a) Java annotations are NOT captured in nodes.decorators (always null) — framework detection must rely on imports + routes, not decorators. (b) unresolved_refs was empty for this repo. (c) Manifest files (pom.xml, application.yml) are listed in the files table but their CONTENTS are not parsed into symbols — dependency-level analysis (e.g. Maven deps) needs separate parsing outside CodeGraph.\n5. MECHANICS for the analyze pipeline: CodeGraph writes its index INTO the target project root (.codegraph/, not relocatable) — so analyze must copy/clone targets to a scratch dir or accept writing into the target; the npm package (@colbymchenry/codegraph) is self-contained (bundled Node 24 runtime shim), so host Node version is irrelevant; DB is plain SQLite readable read-only via node:sqlite (Node >= 22.5).\n\nVerified by scripts/research/01-codegraph-db-survey.test.ts (6 assertions) — pnpm test 13/13 green.',
      tags: 'codegraph,tree-sitter,database,language-detection,framework-detection',
      createdAt: '2026-07-08T18:53:29.858Z',
      updatedAt: '2026-07-08T19:21:38.775Z',
    },
  ];

  const activityRows = [
    {
      id: 'act_IgX5d48pZActiebmgU9ja',
      activity:
        'Extended PR #3 so tecture-io is also referenced via an on-demand GitHub clone — no reference project uses a local path anymore',
      details:
        "Files: CLAUDE.md (Reference Projects). Convention now stated once at the section top: clone into /tmp/tecture-graph-references/<name>, reuse existing clone, read-only. tecture-io URL https://github.com/tecture-io/tecture (from local clone's origin remote, verified public). Each of the three sections leads with its git clone command. Verified nothing in the codebase imports from the old local paths (only a .claude/settings.local.json permission entry mentions them). Commit b3c952a on docs/reference-repos-from-github; PR https://github.com/shanika/tecture-graph/pull/3 body updated.",
      researchId: null,
      createdAt: '2026-07-08T21:29:16.307Z',
    },
    {
      id: 'act_szJur5qOp--a9rh2oOJ5W',
      activity:
        'Switched the CLAUDE.md CodeGraph reference from the fork (shanika/codegraph) to the upstream repo (colbymchenry/codegraph) on PR #3',
      details:
        'Files: CLAUDE.md (CodeGraph section). Clone instruction now uses https://github.com/colbymchenry/codegraph; removed the fork/upstream note. Commit 23d7de1 pushed to docs/reference-repos-from-github; PR https://github.com/shanika/tecture-graph/pull/3 updated. Maintainer decision: reference the original repo, not the fork.',
      researchId: null,
      createdAt: '2026-07-08T21:23:09.335Z',
    },
    {
      id: 'act_nJF3VgwDZx1_UtbUHZBjk',
      activity:
        'Updated CLAUDE.md so CodeGraph and Understand-Anything are referenced via on-demand GitHub clones instead of machine-specific local checkouts (PR #3)',
      details:
        'Files: CLAUDE.md (Reference Projects section). Replaced local paths /Users/shanika/projects/codegraph and .../Understand-Anything with clone-on-demand instructions: git clone --depth 1 into /tmp/tecture-graph-references/<name>, reuse existing clone, treat as read-only (same convention as test fixture repos). URLs: https://github.com/shanika/codegraph (fork; upstream colbymchenry/codegraph) and https://github.com/Egonex-AI/Understand-Anything — both verified public via GitHub API (HTTP 200 unauthenticated). tecture-io intentionally left as a local checkout. Branch docs/reference-repos-from-github, PR https://github.com/shanika/tecture-graph/pull/3 awaiting maintainer review.',
      researchId: null,
      createdAt: '2026-07-08T21:19:38.676Z',
    },
    {
      id: 'act_s8ddDizABDq2djhD4U7CW',
      activity:
        'Built and ran research script 01-codegraph-db-survey: indexes a scratch copy of dddsample-core with CodeGraph (npm @colbymchenry/codegraph, self-contained bundled-runtime shim) and surveys the resulting SQLite DB via node:sqlite',
      details:
        "Worktree ../tecture-graph-research-codegraph-db-survey (branch research/codegraph-db-survey). Files: scripts/research/01-codegraph-db-survey.ts (+ .test.ts), root devDeps tsx + @colbymchenry/codegraph. Key mechanics discovered: (1) CodeGraph writes its index INTO the project root (.codegraph/codegraph.db, not relocatable), so the script copies the fixture (minus .git) to /tmp/tecture-graph-research/ before indexing — fixture clones stay read-only. (2) The npm package is a thin shim exec-ing a bundled Node 24 runtime, so the host Node version doesn't matter (running CodeGraph from source would hard-block on Node 25 due to a V8 WASM bug). (3) Full index of dddsample-core takes ~4s and is deterministic — identical counts across fresh re-runs. Report written to output/research/01-codegraph-db-survey/report.json.",
      researchId: 'res_CmR_jwPkQ-8WiaSJH0xxj',
      createdAt: '2026-07-08T19:18:52.355Z',
    },
    {
      id: 'act_GtY-Ty_Y7QtWjJxpszxNK',
      activity:
        'PR #1 (Research Workflow + Git Workflow sections in CLAUDE.md) was merged by the maintainer; synced main and deleted the branch.',
      details:
        'Merge commit 0570efa on main. Local branch docs/research-and-git-workflow deleted. CLAUDE.md conventions now in effect on main: Waggle logging, maintainer-planned worktree-isolated research, and never-push-to-main.',
      researchId: null,
      createdAt: '2026-07-08T18:41:16.977Z',
    },
    {
      id: 'act_zbPqyyxpkZTCOe8NwWML6',
      activity: 'Opened PR #1 with the CLAUDE.md Research Workflow and Git Workflow sections.',
      details:
        'Branch docs/research-and-git-workflow, commit 132e352, PR: https://github.com/shanika/tecture-graph/pull/1. First PR under the new never-push-to-main rule; awaiting maintainer review/merge.',
      researchId: null,
      createdAt: '2026-07-08T18:37:32.709Z',
    },
    {
      id: 'act_sGMxQNUspXUiYdqsSgtAk',
      activity:
        'Added a Git Workflow rule to CLAUDE.md: never push to main directly, always branch and open a PR.',
      details:
        'Files touched: CLAUDE.md (new "Git Workflow" section before Package Manager). Rule applies to all changes including docs/CLAUDE.md edits: commit to a feature branch or research worktree branch, push the branch, open a PR with gh pr create; never git push while on main.',
      researchId: null,
      createdAt: '2026-07-08T18:36:21.565Z',
    },
    {
      id: 'act_fm7Xwt5847VJkP_uZH0-h',
      activity:
        'Added a Research Workflow section to CLAUDE.md defining the maintainer-planned, worktree-isolated, Waggle-tracked research lifecycle.',
      details:
        'Files touched: CLAUDE.md. New "Research Workflow" section after the Waggle logging section: research is planned collaboratively with the maintainer, recorded first via log_tecture_research (with all activities/test runs linked via researchId), executed in a dedicated git worktree (research/<slug> branch), concluded either with a PR + status completed, or with no PR + status abandoned and results explaining the failure, and the worktree is removed either way so Waggle holds the durable record. Also updated the Development Philosophy bullet: unsuccessful experiments are now discarded from the codebase with Waggle as the record (previously they stayed in the repo).',
      researchId: null,
      createdAt: '2026-07-08T18:32:32.151Z',
    },
    {
      id: 'act_bXjv4O7B4l5G_Th76KQzO',
      activity:
        "Added a mandatory Waggle activity-logging section to CLAUDE.md and wrote the project's initial Waggle progress entry.",
      details:
        'Files touched: CLAUDE.md (new "Activity Logging with Waggle (required)" section between Development Philosophy and Package Manager). The section instructs agents to: read_progress at session start; log_activity for every meaningful change/script run/decision as they go; create a research record via log_tecture_research for each scripts/research/ step, link activities via researchId, and close with update_tecture_research; publish_test_results at meaningful checkpoints; write_progress at session end; and report if Waggle is unreachable rather than silently skipping.',
      researchId: null,
      createdAt: '2026-07-08T18:25:33.598Z',
    },
  ];

  const testRunRows = [
    {
      id: 'run_dBITFCRO0e1vBl7qLLahl',
      suite: 'pnpm test (worktree research/codegraph-db-survey)',
      status: 'passed',
      total: 13,
      passed: 13,
      failed: 0,
      skipped: 0,
      durationMs: 895,
      summary:
        'All suites green: 7 existing analyze tests + 6 new research-01 assertions (language detection, symbol/edge inventory, Spring evidence, documented gaps) against the dddsample-core CodeGraph DB',
      output: null,
      researchId: 'res_CmR_jwPkQ-8WiaSJH0xxj',
      ranAt: '2026-07-08T19:19:51.058Z',
    },
  ];

  const progressRows = [
    {
      id: 'prog_d-eIV8tKfidvLWUdGWm1i',
      summary:
        'Early scaffolding stage. The pnpm monorepo is set up with the @tecture-graph/analyze walking skeleton (CLI entry + core API), the on-demand fixture-clone convention is implemented (ensureFixtureRepo, cloning public repos into /tmp/tecture-graph-fixtures), and CLAUDE.md documents the project vision, C4 scope, development philosophy, reference projects, and (as of today) mandatory Waggle activity logging. No analysis logic exists yet — the next step is the first real analysis increment against the dddsample-core fixture.',
      details:
        'Done:\n- pnpm monorepo scaffold with packages/analyze (@tecture-graph/analyze, bin "analyze"; src/cli.ts entry, src/index.ts core API), TypeScript strict ESM (NodeNext, ES2022), Node >= 20, root Vitest config picking up all workspace suites (commit ee889c2).\n- Fixture management: ensureFixtureRepo(gitHubUrl) in packages/analyze/src/fixtures.ts shallow-clones public GitHub repos into /tmp/tecture-graph-fixtures/<owner>-<repo> and reuses existing clones; TECTURE_FIXTURES_DIR overrides the cache dir. Tests use the public fixture repo citerus/dddsample-core (commit e8d7550).\n- CLAUDE.md: project overview, vision (per-repo analysis -> central server -> org-wide architecture graph), C4 Containers/Components scope, "verifiable feedback loops first" philosophy (Vitest, no manual testing, a script per research step under scripts/research/), reference projects (tecture-io = output format to match, CodeGraph = tree-sitter engine, Understand-Anything = implementation ideas), and a new mandatory Waggle logging section (this entry is the first written under it).\n- Waggle MCP server wired up via .mcp.json (server lives at ../mcp-waggle); all 9 tools verified reachable.\n\nIn flight:\n- Nothing mid-implementation; .mcp.json is uncommitted on main.\n\nNext:\n- First analysis increment: run tree-sitter/CodeGraph indexing over the dddsample-core fixture as a research step (script under scripts/research/ + Vitest test + Waggle research record).\n- Produce a first architecture/ output tree (manifest.json + diagrams) validating against tecture-io\'s @tecture/shared format validators.\n\nBlockers: none.',
      createdAt: '2026-07-08T18:25:30.626Z',
    },
    {
      id: 'prog_bg9F1bObIZ62SdpTvYNtW',
      summary:
        "First research step completed and confirmed: the CodeGraph tree-sitter SQLite database, queried directly, yields the target repo's language (files.language), framework evidence (qualified import paths — org.springframework ×164 — plus synthesized HTTP route nodes from Spring MVC annotations), and C4-relevant structure (namespace nodes = Java packages, contains/calls/imports/implements edges). Research script + Vitest test are on PR #2 (research/codegraph-db-survey) awaiting maintainer review; Waggle research res_CmR_jwPkQ-8WiaSJH0xxj has the full findings.",
      details:
        "Done:\n- Research 01 (res_CmR_jwPkQ-8WiaSJH0xxj, completed): scripts/research/01-codegraph-db-survey.ts + .test.ts on branch research/codegraph-db-survey, PR https://github.com/shanika/tecture-graph/pull/2. Pattern established for future research: worktree + script under scripts/research/ + Vitest test + report JSON under gitignored output/.\n- Key findings: language detection trivial from files table; framework detectable from import-node namespace prefixes and synthesized route nodes; namespace nodes + edge graph (contains 2584 / calls 1287 / references 934 / instantiates 507 / imports 470) are the raw material for C4 component clustering. Gaps: Java annotations not in nodes.decorators; manifest contents (pom.xml) not parsed into symbols — dependency-level info needs separate parsing.\n- Mechanics: CodeGraph writes .codegraph/ into the indexed project root (not relocatable) → analyze must index a scratch copy (script uses /tmp/tecture-graph-research/); npm @colbymchenry/codegraph is self-contained (bundled Node 24 shim), host Node version irrelevant; DB readable read-only via node:sqlite. Indexing dddsample-core: ~4s, deterministic.\n- Root devDeps added on the branch: tsx, @colbymchenry/codegraph. pnpm test 13/13 green (published to Waggle).\n\nIn flight:\n- PR #2 awaiting maintainer review/merge. Worktree removed; branch kept for the PR.\n\nNext:\n- After merge: decide the analyze pipeline's CodeGraph invocation strategy (scratch-copy convention from the research script likely graduates into the tool).\n- Next research candidates: (a) can namespace/contains/calls edges cluster dddsample-core into sensible C4 components (docs/c4-component-detection.md approach); (b) manifest parsing (pom.xml deps) as a complementary framework/dependency signal outside CodeGraph.\n\nBlockers: none.",
      createdAt: '2026-07-08T19:23:02.490Z',
    },
    {
      id: 'prog_ES1W0vG32kmXBfPpTPenH',
      summary:
        "CLAUDE.md's reference projects (tecture-io, CodeGraph, Understand-Anything) no longer depend on machine-specific local checkouts: PR #3 (docs/reference-repos-from-github) documents one convention — clone each from GitHub into /tmp/tecture-graph-references/<name> on demand, reuse existing clones, treat them read-only — with each section leading with its git clone command. PR #3 awaits maintainer review, alongside research PR #2 from the previous session.",
      details:
        'Done this session:\n- PR #3 https://github.com/shanika/tecture-graph/pull/3 (3 commits): Reference Projects section rewritten. Convention stated once at the section top (mirrors the Test Target Repos fixture convention). URLs: https://github.com/tecture-io/tecture, https://github.com/colbymchenry/codegraph (upstream chosen over the shanika fork per maintainer), https://github.com/Egonex-AI/Understand-Anything — all verified publicly cloneable without credentials.\n- Verified no code imports from the old local paths, so this is a docs-only change.\n\nIn flight:\n- PR #2 (research/codegraph-db-survey) and PR #3 both awaiting maintainer review/merge. Local checkout clean on main.\n\nNext:\n- Unchanged from previous entry: after PR #2 merges, decide the analyze pipeline\'s CodeGraph invocation strategy; next research candidates are C4 component clustering from the namespace/edge graph and pom.xml manifest parsing.\n\nBlockers: none.',
      createdAt: '2026-07-08T21:29:35.771Z',
    },
  ];

  const inserted = {
    researches: db.insert(researchActivities).values(researchRows).onConflictDoNothing().run()
      .changes,
    activities: db.insert(activities).values(activityRows).onConflictDoNothing().run().changes,
    testRuns: db.insert(testRuns).values(testRunRows).onConflictDoNothing().run().changes,
    progressEntries: db.insert(progressEntries).values(progressRows).onConflictDoNothing().run()
      .changes,
  };
  return inserted;
}
