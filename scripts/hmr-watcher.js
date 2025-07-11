#!/usr/bin/env node

import { execSync } from 'child_process';
import { watch } from 'fs';
import path from 'path';

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
console.log('🚀 Starting HMR for PXL Node.js Framework');
buildAndPush();

// Watch for changes
const srcPath = path.join(process.cwd(), 'src');
console.log(`👁️  Watching for changes in: ${srcPath}`);

watch(srcPath, { recursive: true }, (eventType, filename) => {
  if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
    console.log(`📝 Changed: ${filename}`);
    buildAndPush();
  }
});

console.log('🎯 HMR watcher started. Press Ctrl+C to stop.');
