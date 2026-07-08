// Automated smoke test of the built artifact: spawns dist/index.js over real
// STDIO, lists tools, and round-trips one entry per tool group against a
// throwaway database. Exits non-zero on any failure.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'waggle-smoke-'));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [new URL('../dist/index.js', import.meta.url).pathname],
  env: { ...process.env, DB_PATH: join(dataDir, 'waggle.db') },
});
const client = new Client({ name: 'smoke', version: '0.0.0' });

function parse(result) {
  if (result.isError) throw new Error(`tool returned error: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
}

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  if (tools.length !== 11) throw new Error(`expected 11 tools, got ${tools.length}`);

  const research = parse(
    await client.callTool({
      name: 'log_tecture_research',
      arguments: { title: 'smoke', goal: 'verify built server works' },
    }),
  );
  parse(
    await client.callTool({
      name: 'publish_test_results',
      arguments: { suite: 'smoke', passed: 1, failed: 0, researchId: research.id },
    }),
  );
  parse(await client.callTool({ name: 'write_progress', arguments: { summary: 'smoke ok' } }));
  const progress = parse(await client.callTool({ name: 'read_progress', arguments: {} }));
  if (progress.latest?.summary !== 'smoke ok') throw new Error('progress round-trip failed');
  const full = parse(
    await client.callTool({ name: 'get_tecture_research', arguments: { researchId: research.id } }),
  );
  if (full.testRuns.length !== 1) throw new Error('test run not linked to research');

  console.log(`smoke OK — ${tools.length} tools, research/test/progress round-trips passed`);
} finally {
  await client.close();
  rmSync(dataDir, { recursive: true, force: true });
}
