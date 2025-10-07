#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'white') {
  let colorCode;
  switch (color) {
    case 'red':
      colorCode = colors.red;
      break;
    case 'green':
      colorCode = colors.green;
      break;
    case 'yellow':
      colorCode = colors.yellow;
      break;
    case 'blue':
      colorCode = colors.blue;
      break;
    case 'magenta':
      colorCode = colors.magenta;
      break;
    case 'cyan':
      colorCode = colors.cyan;
      break;
    case 'white':
    default:
      colorCode = colors.white;
  }
  console.log(`${colorCode}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function execCommand(command, description) {
  try {
    info(`${description}...`);
    const result = execSync(command, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return result.trim();
  } catch (err) {
    error(`Failed to ${description.toLowerCase()}: ${err.message}`);
    process.exit(1);
  }
}

function getCurrentVersion() {
  const packagePath = join(projectRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

function updatePackageVersion(newVersion) {
  const packagePath = join(projectRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function validateVersion(version) {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!versionRegex.test(version)) {
    error('Invalid version format. Use semantic versioning (e.g., 1.0.0)');
    process.exit(1);
  }
}

function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    if (status.trim()) {
      error('Working directory is not clean. Please commit or stash your changes.');
      console.log('\nUncommitted changes:');
      console.log(status);
      process.exit(1);
    }
  } catch {
    error('Failed to check git status');
    process.exit(1);
  }
}

function getCurrentBranch() {
  return execCommand('git rev-parse --abbrev-ref HEAD', 'Getting current branch');
}

function incrementVersion(currentVersion, type) {
  const parts = currentVersion.split('.').map(Number);

  switch (type) {
    case 'patch':
      parts[2]++;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    default:
      error(`Invalid version type: ${type}. Use 'patch', 'minor', or 'major'`);
      process.exit(1);
  }

  return parts.join('.');
}

function showHelp() {
  console.log(`
${colors.cyan}PXL Node.js Framework Release Script${colors.reset}

Usage: npm run release [options]

Options:
  --version <version>     Specify exact version (e.g., 1.2.3)
  --patch                 Increment patch version (1.0.0 → 1.0.1)
  --minor                 Increment minor version (1.0.0 → 1.1.0)
  --major                 Increment major version (1.0.0 → 2.0.0)
  --dry-run              Preview changes without executing
  --help, -h             Show this help message

Examples:
  npm run release -- --patch
  npm run release -- --version 2.0.0
  npm run release -- --minor --dry-run

${colors.yellow}Note: This script will:${colors.reset}
1. Check that working directory is clean
2. Ensure you're on main/master branch
3. Update package.json version
4. Create a git commit and tag
5. Push to origin (triggers CI/CD)
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const isDryRun = args.includes('--dry-run');

  // Get version arguments
  const versionIndex = args.indexOf('--version');
  const hasPatch = args.includes('--patch');
  const hasMinor = args.includes('--minor');
  const hasMajor = args.includes('--major');

  if ([versionIndex !== -1, hasPatch, hasMinor, hasMajor].filter(Boolean).length !== 1) {
    error('Please specify exactly one version option: --version, --patch, --minor, or --major');
    showHelp();
    process.exit(1);
  }

  log(`\n🚀 ${colors.cyan}PXL Node.js Framework Release Script${colors.reset}\n`);

  // Check git status
  checkGitStatus();

  // Check current branch
  const currentBranch = getCurrentBranch();
  if (!['main', 'master'].includes(currentBranch)) {
    warning(`You are on branch '${currentBranch}'. Releases should typically be made from 'main' or 'master'.`);
    if (!isDryRun) {
      // For simplicity, we'll just proceed with a warning rather than prompting
      warning('Proceeding with release on current branch...');
    }
  }

  // Get current version
  const currentVersion = getCurrentVersion();
  info(`Current version: ${currentVersion}`);

  // Determine new version
  let newVersion;
  if (versionIndex !== -1) {
    newVersion = args[versionIndex + 1];
    if (!newVersion) {
      error('--version requires a version number');
      process.exit(1);
    }
    validateVersion(newVersion);
  } else if (hasPatch) {
    newVersion = incrementVersion(currentVersion, 'patch');
  } else if (hasMinor) {
    newVersion = incrementVersion(currentVersion, 'minor');
  } else if (hasMajor) {
    newVersion = incrementVersion(currentVersion, 'major');
  }

  // Check if version is actually changing
  if (newVersion === currentVersion) {
    warning(`Version ${newVersion} is already the current version. No changes needed.`);
    info('If you want to create a new release, please specify a different version.');
    process.exit(0);
  }

  success(`New version: ${newVersion}`);

  if (isDryRun) {
    warning('DRY RUN - No changes will be made');
    console.log('\nWould execute the following steps:');
    console.log(`1. Update package.json version to ${newVersion}`);
    console.log(`2. Git add package.json`);
    console.log(`3. Git commit -m "chore: release v${newVersion}"`);
    console.log(`4. Git tag v${newVersion}`);
    console.log(`5. Git push origin ${currentBranch}`);
    console.log(`6. Git push origin v${newVersion}`);
    return;
  }

  try {
    // Update package.json
    updatePackageVersion(newVersion);
    success('Updated package.json');

    // Run typecheck to catch TypeScript errors before committing
    execCommand('npm run typecheck', 'Running typecheck');

    // Git operations
    execCommand('git add package.json', 'Staging package.json');
    execCommand(`git commit -m "chore: release v${newVersion}"`, 'Creating release commit');
    execCommand(`git tag v${newVersion}`, 'Creating git tag');
    execCommand(`git push origin ${currentBranch}`, 'Pushing branch to origin');
    execCommand(`git push origin v${newVersion}`, 'Pushing tag to origin');

    success(`\n🎉 Release v${newVersion} created successfully!`);
    info(`GitHub Actions will now build and publish the release.`);
    info(`Monitor the progress at: https://github.com/your-org/pxl-nodejs-framework/actions`);
  } catch (err) {
    error(`Release failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
