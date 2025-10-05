#!/usr/bin/env node

import { spawn } from 'child_process';
import { watch } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// HMR State
let buildProcess = null;
let tscWatchProcess = null;
let esbuildWatchProcess = null;
let isBuilding = false;
let pendingChanges = new Set();
let debounceTimer = null;
let lastBuildSuccess = true;
let buildStartTime = null;

// Change detection
const changesByType = {
  routes: new Set(),
  controllers: new Set(),
  config: new Set(),
  core: new Set(),
};

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Categorize file changes
function categorizeChange(filename) {
  if (filename.includes('/routes/') || filename.includes('\\routes\\')) {
    changesByType.routes.add(filename);
  } else if (filename.includes('/controller/') || filename.includes('\\controller\\')) {
    changesByType.controllers.add(filename);
  } else if (
    filename.includes('config') ||
    filename.includes('.env') ||
    filename.includes('tsconfig') ||
    filename.includes('package.json')
  ) {
    changesByType.config.add(filename);
  } else {
    changesByType.core.add(filename);
  }
}

// Clear change tracking
function clearChangeTracking() {
  changesByType.routes.clear();
  changesByType.controllers.clear();
  changesByType.config.clear();
  changesByType.core.clear();
}

// Get change summary
function getChangeSummary() {
  const summary = [];
  if (changesByType.routes.size > 0) {
    summary.push(`${changesByType.routes.size} route file(s)`);
  }
  if (changesByType.controllers.size > 0) {
    summary.push(`${changesByType.controllers.size} controller file(s)`);
  }
  if (changesByType.config.size > 0) {
    summary.push(`${changesByType.config.size} config file(s)`);
  }
  if (changesByType.core.size > 0) {
    summary.push(`${changesByType.core.size} core file(s)`);
  }
  return summary.join(', ');
}

// Determine rebuild strategy
function needsFullRebuild() {
  // Config changes always need full rebuild
  if (changesByType.config.size > 0) return true;

  // Core changes need full rebuild
  if (changesByType.core.size > 0) return true;

  // Only routes/controllers changed - could use hot reload in future
  return false;
}

// Run incremental build with TypeScript compiler
async function runIncrementalBuild() {
  return new Promise((resolve, reject) => {
    buildStartTime = Date.now();
    isBuilding = true;

    const changeSummary = getChangeSummary();
    log(`🔄 Rebuilding (${changeSummary})...`, 'cyan');

    // Run esbuild for JS compilation
    const esbuildProcess = spawn('node', ['esbuild.config.js'], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    esbuildProcess.stdout.on('data', data => {
      stdout += data.toString();
    });

    esbuildProcess.stderr.on('data', data => {
      stderr += data.toString();
    });

    esbuildProcess.on('close', code => {
      const buildTime = Date.now() - buildStartTime;

      if (code === 0) {
        // Push to yalc if in local dev mode
        const yalcProcess = spawn('yalc', ['push', '--no-sig'], {
          cwd: rootDir,
          stdio: 'pipe',
        });

        yalcProcess.on('close', yalcCode => {
          isBuilding = false;
          lastBuildSuccess = true;
          clearChangeTracking();

          if (yalcCode === 0) {
            logSuccess(`Build completed in ${buildTime}ms`);
          } else {
            logWarning(`Build completed in ${buildTime}ms (yalc push skipped)`);
          }

          resolve();
        });
      } else {
        isBuilding = false;
        lastBuildSuccess = false;

        logError(`Build failed (${buildTime}ms)`);

        if (stderr) {
          console.error(colors.red + stderr + colors.reset);
        }
        if (stdout) {
          console.log(stdout);
        }

        logInfo('Watcher still active - fix errors and save to retry');
        resolve(); // Don't reject - keep watcher alive
      }
    });

    esbuildProcess.on('error', error => {
      isBuilding = false;
      lastBuildSuccess = false;
      logError(`Build process error: ${error.message}`);
      resolve(); // Don't reject - keep watcher alive
    });
  });
}

// Debounced build trigger
function scheduleBuild() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    if (!isBuilding) {
      await runIncrementalBuild();
    }
  }, 100); // 100ms debounce
}

// Initial build
async function initialBuild() {
  log('🚀 Starting HMR for PXL Node.js Framework', 'bright');
  logInfo('Enhanced mode: Incremental compilation enabled');

  await runIncrementalBuild();
}

// File change handler
function handleFileChange(eventType, filename) {
  if (!filename) return;

  // Filter out non-source files
  if (!filename.endsWith('.ts') && !filename.endsWith('.js')) {
    return;
  }

  // Skip declaration files
  if (filename.endsWith('.d.ts')) {
    return;
  }

  // Skip dist and node_modules
  if (filename.includes('dist/') || filename.includes('node_modules/')) {
    return;
  }

  log(`📝 Changed: ${filename}`, 'gray');

  categorizeChange(filename);
  pendingChanges.add(filename);
  scheduleBuild();
}

// Start watching
async function startWatching() {
  await initialBuild();

  const srcPath = path.join(rootDir, 'src');
  logInfo(`👁️  Watching: ${srcPath}`);

  watch(srcPath, { recursive: true }, handleFileChange);

  logSuccess('HMR watcher started. Press Ctrl+C to stop.');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\n👋 Shutting down HMR watcher...', 'yellow');

    if (tscWatchProcess) tscWatchProcess.kill();
    if (esbuildWatchProcess) esbuildWatchProcess.kill();
    if (buildProcess) buildProcess.kill();

    process.exit(0);
  });
}

// Start the watcher
startWatching().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
