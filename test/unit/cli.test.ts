import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Simple helper to run the built CLI. Assumes `npm run build` executed before tests.
function runCli(args: string[] = []) {
  const bin = path.resolve(__dirname, '../../dist/cli/index.js');
  return execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
}

describe('PXL CLI', () => {
  const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as { version: string };

  it('--version prints version', () => {
    const out = runCli(['--version']).trim();
    expect(out).toBe(pkg.version);
  });

  it('info (default) prints banner with version', () => {
    const out = runCli(['info']);
    expect(out).toContain(pkg.version);
    expect(out).toContain('PXL Node.js Framework');
  });
});
