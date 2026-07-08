#!/usr/bin/env node
import { runMigrations } from './db/migrate.js';
import { runHttp } from './transport/http.js';
import { runStdio } from './transport/stdio.js';

const command = process.argv[2];

if (command === 'migrate') {
  runMigrations();
} else if (process.env.WAGGLE_TRANSPORT === 'http') {
  runHttp().catch((error) => {
    console.error('waggle: fatal error', error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error('waggle: fatal error', error);
    process.exit(1);
  });
}
