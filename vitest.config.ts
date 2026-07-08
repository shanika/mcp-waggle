import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Entry point + STDIO wiring are exercised by running the real server,
        // covered by the InMemoryTransport integration test at the createServer level.
        'src/index.ts',
        'src/db/migrate.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
