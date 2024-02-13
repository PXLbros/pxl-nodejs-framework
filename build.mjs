import esbuild from 'esbuild';

async function build() {
  try {
    const entryPoints = ['src/index.ts'];
    const baseOutDir = 'dist';
    const nodeTarget = 'node20';
    const tsconfigFilePath = 'tsconfig.json';

    // ES Module build
    await esbuild.build({
      entryPoints,
      bundle: true,
      platform: 'node',
      target: nodeTarget,
      format: 'esm',
      outdir: `${baseOutDir}/esm`,
      external: [],
      tsconfig: tsconfigFilePath,
    });

    // CommonJS build
    await esbuild.build({
      entryPoints,
      bundle: true,
      platform: 'node',
      target: nodeTarget,
      format: 'cjs',
      outdir: `${baseOutDir}/cjs`,
      external: [],
      tsconfig: tsconfigFilePath,
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

build();
