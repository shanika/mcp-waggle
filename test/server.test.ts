import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';
import { createTestDatabase, disposeTestDatabase, type TestDatabase } from './db/setup.js';

const EXPECTED_TOOLS = [
  'log_research',
  'update_research',
  'list_research',
  'get_research',
  'publish_test_results',
  'list_test_runs',
  'get_test_run',
  'write_progress',
  'read_progress',
];

describe('MCP server integration', () => {
  let testDb: TestDatabase;
  let client: Client;

  beforeEach(async () => {
    testDb = createTestDatabase();
    const server = createServer(testDb.db);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    disposeTestDatabase(testDb);
  });

  it('exposes all 9 tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('round-trips a research activity through the MCP protocol', async () => {
    const logged = await client.callTool({
      name: 'log_research',
      arguments: { title: 'Cluster imports', goal: 'Recover Maven modules', tags: ['clustering'] },
    });
    expect(logged.isError).toBeFalsy();
    const view = JSON.parse((logged.content as { text: string }[])[0].text);
    expect(view.id).toMatch(/^res_/);

    const fetched = await client.callTool({
      name: 'get_research',
      arguments: { researchId: view.id },
    });
    const fetchedView = JSON.parse((fetched.content as { text: string }[])[0].text);
    expect(fetchedView.title).toBe('Cluster imports');
    expect(fetchedView.testRuns).toEqual([]);
  });

  it('publishes and reads test results through the MCP protocol', async () => {
    const published = await client.callTool({
      name: 'publish_test_results',
      arguments: { suite: 'pnpm test', passed: 12, failed: 0, summary: 'all green' },
    });
    const run = JSON.parse((published.content as { text: string }[])[0].text);
    expect(run.status).toBe('passed');
    expect(run.total).toBe(12);

    const listed = await client.callTool({ name: 'list_test_runs', arguments: {} });
    const runs = JSON.parse((listed.content as { text: string }[])[0].text);
    expect(runs).toHaveLength(1);
  });

  it('writes and reads project progress through the MCP protocol', async () => {
    await client.callTool({
      name: 'write_progress',
      arguments: { summary: 'analyze walking skeleton shipped' },
    });
    const read = await client.callTool({ name: 'read_progress', arguments: {} });
    const progress = JSON.parse((read.content as { text: string }[])[0].text);
    expect(progress.latest.summary).toBe('analyze walking skeleton shipped');
  });

  it('surfaces tool errors as isError results, not protocol failures', async () => {
    const result = await client.callTool({
      name: 'get_research',
      arguments: { researchId: 'res_missing' },
    });
    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0].text).toContain('not found');
  });
});
