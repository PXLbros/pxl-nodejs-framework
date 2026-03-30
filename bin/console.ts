/**
 * PXL Framework Console Entry Point
 *
 * This is a placeholder console launcher for the PXL Framework.
 * For a complete CommandApplication example, see: examples/commands/
 *
 * To create your own CLI application:
 *
 * 1. Create a new project directory with src/index.ts
 * 2. Install dependencies: npm install @scpxl/nodejs-framework yargs
 * 3. Set up CommandApplication (see examples/commands/src/index.ts)
 * 4. Create command files in src/commands/
 * 5. Run with: tsx src/index.ts <command-name> [options]
 *
 * Example structure:
 *
 * your-cli-app/
 * ├── src/
 * │   ├── index.ts           # CommandApplication setup
 * │   └── commands/
 * │       ├── hello.ts       # Your command
 * │       └── process.ts     # Another command
 * ├── package.json
 * └── .env
 *
 * Quick Start:
 * ```bash
 * cd examples/commands
 * npm install
 * npm run dev hello -- --name "World"
 * ```
 *
 * For more information:
 * - See examples/commands/README.md
 * - Read the framework documentation
 * - Check the CommandApplication API docs
 */

import { setExitHandler } from '../src/lifecycle/exit.js';

const APP_ROOT = new URL('../', import.meta.url);

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     PXL Framework Console Launcher    ║');
  console.log('╚════════════════════════════════════════╝\n');

  console.log('This is a placeholder console entry point.');
  console.log('For a complete CLI example, see: examples/commands/\n');

  console.log('Quick Start:');
  console.log('  cd examples/commands');
  console.log('  npm install');
  console.log('  npm run dev hello -- --name "PXL"\n');

  console.log('Available Examples:');
  console.log('  • hello          - Simple greeting command');
  console.log('  • database-seed  - Database integration example');
  console.log('  • queue-process  - Queue management example\n');

  console.log('Learn More:');
  console.log('  📖 examples/commands/README.md');
  console.log('  📦 Framework documentation\n');

  return { code: 0 as const, reason: 'info-displayed' };
}

// Setup exit handler to properly handle process.exit()
setExitHandler(outcome => {
  if (outcome.error) {
    console.error('Exit reason:', outcome.reason, outcome.error);
  }
  process.exit(outcome.code);
});

// Run main and handle result
main()
  .then(outcome => {
    if (outcome.code !== 0) {
      process.exit(outcome.code);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
