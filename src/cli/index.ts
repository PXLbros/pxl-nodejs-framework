/**
 * PXL Framework CLI
 *
 * Responsibilities:
 *  - Provide version information (--version)
 *  - Display framework info (default)
 *  - Placeholder for future subcommands (e.g., generate, doctor, analyze)
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getPackageJson() {
  // Resolve package.json relative to dist structure: dist/cli/index.js -> ../../package.json
  const pkgPath = path.resolve(__dirname, '../../package.json');
  try {
    const raw = await readFile(pkgPath, 'utf8');
    return JSON.parse(raw) as { name?: string; version?: string; description?: string };
  } catch {
    return {};
  }
}

function banner(pkg: { name?: string; version?: string; description?: string }) {
  const name = pkg.name ?? 'PXL';
  const version = pkg.version ?? '0.0.0';
  return [
    `╔${'═'.repeat(46)}╗`,
    `║  ${name.padEnd(20)} v${version.padEnd(19)}║`,
    `╚${'═'.repeat(46)}╝`,
    pkg.description ? `\n${pkg.description}\n` : '\n',
  ].join('\n');
}

async function main(argv = hideBin(process.argv)) {
  const pkg = await getPackageJson();

  const parser = yargs(argv)
    .scriptName('pxl')
    .usage('Usage: $0 <command> [options]')
    .version(pkg.version ?? '0.0.0')
    .alias('v', 'version')
    .describe('version', 'Show CLI / framework version')
    .help('h')
    .alias('h', 'help')
    .wrap(Math.min(100, process.stdout.columns || 100))
    .command(
      ['info', '$0'],
      'Show framework information',
      y => y,
      () => {
        process.stdout.write(banner(pkg));
        console.log('Commands available soon. Roadmap:');
        console.log('  • generate      Scaffolding (planned)');
        console.log('  • doctor        Environment diagnostics (planned)');
        console.log('  • analyze       Project inspection (planned)');
        console.log('\nExamples:');
        console.log('  pxl --version');
        console.log('  pxl info');
        console.log('  pxl help');
      },
    )
    .command(
      'version',
      'Print version (alias of --version)',
      y => y,
      () => {
        console.log(pkg.version ?? '0.0.0');
      },
    )
    .command(
      'doctor',
      'Run environment diagnostics',
      y => y.option('json', { type: 'boolean', default: false, describe: 'Output JSON' }),
      async args => {
        const diagnostics: Record<string, unknown> = {};
        diagnostics.node = process.version;
        diagnostics.platform = `${process.platform} ${process.arch}`;
        diagnostics.cwd = process.cwd();
        diagnostics.memory = process.memoryUsage.rss();
        diagnostics.env = {
          NODE_ENV: process.env.NODE_ENV ?? null,
        };
        diagnostics.features = {
          webcrypto: typeof (globalThis as any).crypto?.subtle !== 'undefined',
          fetch: typeof (globalThis as any).fetch === 'function',
        };
        let exitCode = 0;
        const warnings: string[] = [];
        // Example version check
        const requiredMajor = 22;
        const nodeMajor = Number(process.versions.node.split('.')[0]);
        if (nodeMajor < requiredMajor) {
          warnings.push(`Node.js major version ${nodeMajor} < required ${requiredMajor}`);
          exitCode = 1;
        }
        diagnostics.warnings = warnings;
        if (args.json) {
          console.log(JSON.stringify(diagnostics, null, 2));
        } else {
          console.log('PXL Doctor Report');
          console.log('=================');
          console.log('Node Version:', diagnostics.node);
          console.log('Platform:', diagnostics.platform);
          console.log('Working Directory:', diagnostics.cwd);
          console.log('RSS Memory (MB):', (Number(diagnostics.memory) / 1024 / 1024).toFixed(2));
          console.log('Features:');
          for (const [k, v] of Object.entries(diagnostics.features as Record<string, unknown>)) {
            console.log(`  - ${k}: ${v}`);
          }
          if (warnings.length) {
            console.log('\nWarnings:');
            for (const w of warnings) console.log('  •', w);
          } else {
            console.log('\nNo warnings detected.');
          }
        }
        process.exit(exitCode);
      },
    )
    .strict()
    .fail((msg, err) => {
      if (err) {
        console.error('Error:', err.message);
      } else if (msg) {
        console.error(msg);
      }
      process.exit(1);
    });

  await parser.parseAsync();
}

main().catch(err => {
  console.error('Unhandled CLI error:', err);
  process.exit(1);
});
