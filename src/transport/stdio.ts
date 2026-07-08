import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { openDatabase } from '../db/index.js';
import { createServer, SERVER_NAME, SERVER_VERSION } from '../server.js';

/** Boots the MCP server over STDIO. Used for local Claude Code / Claude Desktop. */
export async function runStdio(): Promise<void> {
  const { db, sqlite } = openDatabase();
  const server = createServer(db);
  const transport = new StdioServerTransport();

  transport.onclose = () => {
    sqlite.close();
  };
  process.once('SIGINT', () => {
    sqlite.close();
    process.exit(0);
  });

  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}
