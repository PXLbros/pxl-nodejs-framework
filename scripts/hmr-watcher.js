#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';

let isBuilding = false;

const buildAndPush = () => {
  if (isBuilding) return;

  isBuilding = true;
  console.log('🔄 Files changed, rebuilding...');

  try {
    execSync('npm run build:local', { stdio: 'inherit' });
    console.log('✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
  } finally {
    isBuilding = false;
  }
};

// Initial build
console.log('🚀 Starting HMR for SC/PXL Node.js Framework');
buildAndPush();

// Watch for changes
const srcPath = path.join(process.cwd(), 'src');
console.log(`👁️  Watching for changes in: ${srcPath}`);

watch(srcPath, { recursive: true }, (_eventType, filename) => {
  if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
    console.log(`📝 Changed: ${filename}`);
    buildAndPush();
  }
});

console.log('🎯 HMR watcher started. Press Ctrl+C to stop.');
