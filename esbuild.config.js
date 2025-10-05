import { build } from 'esbuild';
import { glob } from 'glob';
import { execSync } from 'child_process';

// All library TypeScript files except CLI (we build CLI separately)
const allTs = glob.sync('src/**/*.ts');
const cliEntry = 'src/cli/index.ts';
const libEntryPoints = allTs.filter(p => p !== cliEntry);

const baseConfig = {
  bundle: false,
  outdir: 'dist',
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  keepNames: true,
  loader: { '.ts': 'ts' },
  tsconfig: './tsconfig.json',
  logLevel: 'info',
  minify: false,
  splitting: false,
  write: true,
  preserveSymlinks: false,
  legalComments: 'none',
  color: true,
  drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
};

async function buildProject() {
  console.log('Building with esbuild...');
  const start = Date.now();

  try {
    // Build library sources
    await build({
      ...baseConfig,
      entryPoints: libEntryPoints,
    });

    // Build/bundle CLI with explicit banner & single output
    if (allTs.includes(cliEntry)) {
      await build({
        ...baseConfig,
        // Remove properties incompatible with single-file output
        outdir: undefined,
        entryPoints: [cliEntry],
        bundle: true,
        outfile: 'dist/cli/index.js',
        banner: { js: '#!/usr/bin/env node' },
        external: [],
      });
    }
    const esbuildDuration = Date.now() - start;
    console.log(`✅ JavaScript build completed in ${esbuildDuration}ms`);

    // Generate TypeScript declarations with tsc
    console.log('Generating TypeScript declarations...');
    const tscStart = Date.now();
    execSync('npx tsc --emitDeclarationOnly --declaration', { stdio: 'inherit' });
    const tscDuration = Date.now() - tscStart;
    console.log(`✅ TypeScript declarations generated in ${tscDuration}ms`);

    const totalDuration = Date.now() - start;
    console.log(`🎉 Total build completed in ${totalDuration}ms`);
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildProject();
