import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDatabase, type WaggleDatabase } from './db/index.js';
import { registerProgressTools } from './tools/progress.js';
import { registerResearchTools } from './tools/research.js';
import { registerTestRunTools } from './tools/tests.js';

export const SERVER_NAME = 'mcp-waggle';
export const SERVER_VERSION = '0.1.0';

export function createServer(db: WaggleDatabase): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerResearchTools(server, db);
  registerTestRunTools(server, db);
  registerProgressTools(server, db);
  return server;
}

export async function runServer(): Promise<void> {
  const { db } = openDatabase();
  const server = createServer(db);
  await server.connect(new StdioServerTransport());
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}
