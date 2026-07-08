#!/usr/bin/env node
import { runMigrations } from './db/migrate.js';
import { runServer } from './server.js';

const command = process.argv[2];

if (command === 'migrate') {
  runMigrations();
} else {
  runServer().catch((error) => {
    console.error('waggle: fatal error', error);
    process.exit(1);
  });
}
