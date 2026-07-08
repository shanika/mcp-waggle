import { describe, expect, it } from 'vitest';
import { newProgressId, newResearchId, newTestRunId } from '../../src/lib/ids.js';

describe('id helpers', () => {
  it.each([
    ['newResearchId', newResearchId, 'res_'],
    ['newTestRunId', newTestRunId, 'run_'],
    ['newProgressId', newProgressId, 'prog_'],
  ])('%s produces prefixed unique ids', (_name, factory, prefix) => {
    const ids = new Set(Array.from({ length: 100 }, () => factory()));
    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(id.startsWith(prefix)).toBe(true);
      expect(id.length).toBeGreaterThan(prefix.length + 10);
    }
  });
});
