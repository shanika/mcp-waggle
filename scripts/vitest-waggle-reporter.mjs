// Vitest reporter that produces a Waggle-ready test report.
//
// Vitest's built-in JSON reporter omits per-test console output; this reporter
// captures it via onUserConsoleLog (log.taskId ↔ TestCase.id) and writes a
// payload matching publish_test_results: { suite, durationMs, tests[] } where
// each test carries name, file, status, durationMs, error and logs.
//
// Usage:
//   vitest run --reporter=default --reporter=./scripts/vitest-waggle-reporter.mjs
// Env:
//   WAGGLE_SUITE        suite name in the payload (default: "vitest")
//   WAGGLE_REPORT_FILE  output path (default: waggle-report.json)
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';

export default class WaggleReporter {
  logs = new Map(); // TestCase.id -> string[]
  startedAt = 0;

  onTestRunStart() {
    this.startedAt = Date.now();
    this.logs.clear();
  }

  onUserConsoleLog(log) {
    if (!log.taskId) return; // logs outside any test (e.g. global setup)
    const lines = this.logs.get(log.taskId) ?? [];
    lines.push(log.type === 'stderr' ? `[stderr] ${log.content}` : log.content);
    this.logs.set(log.taskId, lines);
  }

  onTestRunEnd(testModules) {
    const tests = [];
    for (const module of testModules) {
      const file = relative(process.cwd(), module.moduleId);
      for (const test of module.children.allTests()) {
        const result = test.result();
        const diagnostic = test.diagnostic();
        const logs = (this.logs.get(test.id) ?? []).join('').trimEnd();
        tests.push({
          name: test.fullName,
          status:
            result.state === 'passed' ? 'passed' : result.state === 'failed' ? 'failed' : 'skipped',
          file,
          ...(diagnostic ? { durationMs: Math.round(diagnostic.duration) } : {}),
          ...(result.errors?.length
            ? { error: result.errors.map((e) => e.stack || e.message).join('\n\n') }
            : {}),
          ...(logs ? { logs } : {}),
        });
      }
    }
    const payload = {
      suite: process.env.WAGGLE_SUITE ?? 'vitest',
      durationMs: Date.now() - this.startedAt,
      tests,
    };
    const outFile = process.env.WAGGLE_REPORT_FILE ?? 'waggle-report.json';
    writeFileSync(outFile, JSON.stringify(payload, null, 2));
    console.log(`waggle report: ${tests.length} tests → ${outFile}`);
  }
}
