import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WaggleDatabase } from './db/index.js';
import { registerActivityTools } from './tools/activities.js';
import { registerProgressTools } from './tools/progress.js';
import { registerResearchTools } from './tools/research.js';
import { registerTestRunTools } from './tools/tests.js';

export const SERVER_NAME = 'mcp-waggle';
export const SERVER_VERSION = '0.2.0';

export function createServer(db: WaggleDatabase): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerResearchTools(server, db);
  registerActivityTools(server, db);
  registerTestRunTools(server, db);
  registerProgressTools(server, db);
  return server;
}
