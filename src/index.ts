#!/usr/bin/env node
import { openDatabase } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { runHttp } from './transport/http.js';
import { runStdio } from './transport/stdio.js';
import { runUi } from './ui/app.js';

const command = process.argv[2];

if (command === 'migrate') {
  runMigrations();
} else if (command === 'seed') {
  const { db, sqlite } = openDatabase();
  const inserted = seedDatabase(db);
  sqlite.close();
  console.log(
    `waggle: seeded ${inserted.researches} researches, ${inserted.activities} activities, ` +
      `${inserted.testRuns} test runs, ${inserted.progressEntries} progress entries ` +
      '(existing rows left untouched)',
  );
} else if (command === 'ui') {
  runUi().catch((error) => {
    console.error('waggle: fatal error', error);
    process.exit(1);
  });
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
