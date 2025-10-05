import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

// Import named exports from the script (ESM)
import {
  parseCliOptions,
  formatBytes,
  formatRelativeTime,
  loadIgnoreConfig,
  createPathFilter,
} from '../../scripts/framework-status.js';

describe('framework-status utilities', () => {
  it('parseCliOptions parses exclude list variants', () => {
    const opts = parseCliOptions(['--exclude=coverage,**/*.snap', '--exclude', 'fixtures']);
    expect(opts.excludePatterns).toContain('coverage');
    expect(opts.excludePatterns).toContain('**/*.snap');
    expect(opts.excludePatterns).toContain('fixtures');
  });

  it('formatBytes produces human readable sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    // Accept either 1.0 or 1.00 depending on formatting
    expect(formatBytes(1024)).toMatch(/1\.0+ KB/);
    expect(formatBytes(1024 * 1024)).toMatch(/1\.0+ MB/);
  });

  it('formatRelativeTime handles past times', () => {
    const d = new Date(Date.now() - 65 * 1000); // 65 seconds ago
    const rel = formatRelativeTime(d);
    expect(rel).toMatch(/minute/);
  });

  it('ignore + pathFilter skips excluded patterns', async () => {
    const { gitMatcher, excludeMatcher, appliesToNodeModules } = await loadIgnoreConfig(['fixtures']);
    const filter = createPathFilter({
      gitMatcher,
      excludeMatcher,
      includeCache: false,
      appliesToNodeModules,
    });

    expect(filter.shouldSkip('fixtures/example.txt')).toBe(true);
    expect(filter.shouldSkip('src/index.ts')).toBe(false);
  });
});
