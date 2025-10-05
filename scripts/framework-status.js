#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import fastFolderSizeModule from 'fast-folder-size';
import ignore from 'ignore';
import simpleGit from 'simple-git';

const execFileAsync = promisify(execFile);
const fastFolderSizeCallback =
  typeof fastFolderSizeModule === 'function' ? fastFolderSizeModule : fastFolderSizeModule?.default;

if (typeof fastFolderSizeCallback !== 'function') {
  throw new TypeError('fast-folder-size did not provide an executable function');
}

const fastFolderSizeAsync = promisify(fastFolderSizeCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const numberFormatter = new Intl.NumberFormat('en-US');
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const git = simpleGit({ baseDir: rootDir, maxConcurrentProcesses: 1 });

const DEFAULT_EXCLUDE_PATTERNS = Object.freeze([
  'coverage/',
  '**/coverage/',
  '**/coverage/**',
  'fixtures/',
  '**/fixtures/',
  '**/fixtures/**',
  '**/*.snap',
]);

const ALWAYS_INCLUDE_TOP_LEVEL = new Set(['dist', 'node_modules']);

function toPosixPath(p) {
  return p.split(path.sep).join('/');
}

function isCachePath(normalizedPath) {
  return (
    normalizedPath === '.turbo' ||
    normalizedPath.startsWith('.turbo/') ||
    normalizedPath.includes('/.turbo/') ||
    normalizedPath === '.next/cache' ||
    normalizedPath.startsWith('.next/cache/') ||
    normalizedPath.includes('/.next/cache')
  );
}

const colors = {
  title: text => (supportsColor ? `\u001b[36;1m${text}\u001b[0m` : text),
  section: text => (supportsColor ? `\u001b[33;1m${text}\u001b[0m` : text),
  dim: text => (supportsColor ? `\u001b[2m${text}\u001b[0m` : text),
  value: text => (supportsColor ? `\u001b[35m${text}\u001b[0m` : text),
};

function parseCliOptions(argv) {
  const options = {
    includeCache: false,
    excludePatterns: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--include-cache') {
      options.includeCache = true;
      continue;
    }
    if (arg === '--exclude') {
      const next = argv[index + 1];
      if (next) {
        options.excludePatterns.push(
          ...next
            .split(',')
            .map(part => part.trim())
            .filter(Boolean),
        );
      }
      index += 1;
      continue;
    }
    if (arg.startsWith('--exclude=')) {
      const value = arg.slice('--exclude='.length);
      if (value) {
        options.excludePatterns.push(
          ...value
            .split(',')
            .map(part => part.trim())
            .filter(Boolean),
        );
      }
      continue;
    }
  }

  options.excludePatterns = options.excludePatterns.map(pattern => pattern.replace(/\\/g, '/')).filter(Boolean);

  return options;
}

async function loadIgnoreConfig(extraExcludePatterns) {
  const gitignoreMatcher = ignore();
  let gitPatternCount = 0;
  for (const filename of ['.gitignore', '.npmignore']) {
    const filePath = path.join(rootDir, filename);
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const lines = raw
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      if (lines.length > 0) {
        gitignoreMatcher.add(lines);
        gitPatternCount += lines.length;
      }
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  const gitMatcher = gitPatternCount > 0 ? gitignoreMatcher : null;

  const excludeMatcher = ignore();
  const seen = new Set();
  const patterns = [];
  for (const pattern of [...DEFAULT_EXCLUDE_PATTERNS, ...extraExcludePatterns]) {
    const trimmed = pattern.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    patterns.push(trimmed);
  }

  if (patterns.length > 0) {
    excludeMatcher.add(patterns);
  }

  const appliesToNodeModules = extraExcludePatterns.some(pattern => pattern.includes('node_modules'));
  const excludeMatcherFinal = patterns.length > 0 ? excludeMatcher : null;

  return {
    gitMatcher,
    excludeMatcher: excludeMatcherFinal,
    appliesToNodeModules,
  };
}

function createPathFilter({ gitMatcher, excludeMatcher, includeCache, appliesToNodeModules }) {
  const skipCache = !includeCache;

  const shouldSkip = (relativePath, { isDir = false, rootLabel } = {}) => {
    if (!relativePath) {
      return false;
    }

    const normalized = toPosixPath(relativePath);
    if (skipCache && isCachePath(normalized)) {
      return true;
    }

    const lookupPath = isDir ? `${normalized}/` : normalized;
    const topLevel = rootLabel ?? normalized.split('/')[0] ?? normalized;

    if (excludeMatcher) {
      const shouldApplyExcludes = topLevel === 'node_modules' ? appliesToNodeModules : true;
      if (shouldApplyExcludes && excludeMatcher.ignores(lookupPath)) {
        return true;
      }
    }

    if (!ALWAYS_INCLUDE_TOP_LEVEL.has(topLevel) && gitMatcher && gitMatcher.ignores(lookupPath)) {
      return true;
    }

    return false;
  };

  const requiresFiltering = rootLabel => {
    if (rootLabel === 'node_modules') {
      return appliesToNodeModules && !!excludeMatcher;
    }
    if (skipCache) {
      return true;
    }
    if (excludeMatcher) {
      return true;
    }
    if (gitMatcher && !ALWAYS_INCLUDE_TOP_LEVEL.has(rootLabel)) {
      return true;
    }
    return false;
  };

  return { shouldSkip, requiresFiltering };
}

function formatRelativeTime(targetDate) {
  if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) {
    return null;
  }

  const diffMs = Date.now() - targetDate.getTime();
  const absDiff = Math.abs(diffMs);
  const units = [
    { label: 'day', ms: 24 * 60 * 60 * 1000 },
    { label: 'hour', ms: 60 * 60 * 1000 },
    { label: 'minute', ms: 60 * 1000 },
  ];

  for (const { label, ms } of units) {
    if (absDiff >= ms) {
      const value = Math.floor(absDiff / ms);
      const suffix = value === 1 ? label : `${label}s`;
      return `${value} ${suffix} ${diffMs >= 0 ? 'ago' : 'from now'}`;
    }
  }

  return diffMs >= 0 ? 'seconds ago' : 'seconds from now';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'n/a';
  }
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const decimals = value >= 10 || exponent === 0 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

async function readPackageJson() {
  const pkgPath = path.join(rootDir, 'package.json');
  const raw = await fs.promises.readFile(pkgPath, 'utf8');
  return JSON.parse(raw);
}

async function walkDirectory(dir, stats, shouldSkip, rootLabel) {
  const directory = await fs.promises.opendir(dir);
  const pending = [];
  for await (const entry of directory) {
    const entryPath = path.join(dir, entry.name);
    const relativePath = toPosixPath(path.relative(rootDir, entryPath));

    if (shouldSkip?.(relativePath, { isDir: entry.isDirectory(), rootLabel })) {
      continue;
    }

    if (entry.isSymbolicLink?.()) {
      continue;
    }

    if (entry.isDirectory()) {
      stats.dirs += 1;
      pending.push(walkDirectory(entryPath, stats, shouldSkip, rootLabel));
    } else if (entry.isFile()) {
      stats.files += 1;
      pending.push(
        fs.promises
          .stat(entryPath)
          .then(fileStats => {
            stats.size += fileStats.size;
          })
          .catch(() => {}),
      );
    }
  }
  await Promise.all(pending);
}

async function getDirectoryStats(dir, options = {}) {
  const { includeCounts = true, pathFilter } = options;
  try {
    const details = await fs.promises.stat(dir);
    if (!details.isDirectory()) {
      return null;
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const stats = { size: 0, files: 0, dirs: 0 };
  const relativeRoot = toPosixPath(path.relative(rootDir, dir)) || path.basename(dir);
  const rootLabel = relativeRoot.split('/')[0] || relativeRoot;
  const requiresFilter = pathFilter?.requiresFiltering(rootLabel) ?? false;

  if (!includeCounts && !requiresFilter) {
    try {
      const size = await fastFolderSizeAsync(dir);
      if (Number.isFinite(size)) {
        return { size };
      }
    } catch (error) {
      // fall through to manual walk on failure
      if (process.env.DEBUG?.includes('framework-status')) {
        console.debug('fast-folder-size failed for', dir, error);
      }
    }
  }

  await walkDirectory(dir, stats, pathFilter?.shouldSkip, rootLabel);
  if (!includeCounts) {
    return { size: stats.size };
  }
  return stats;
}

async function getGitBranch() {
  try {
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  } catch (error) {
    return null;
  }
}

async function getGitSummary() {
  try {
    const log = await git.log({ n: 1 });
    const latest = log?.latest;
    if (!latest) {
      return null;
    }
    const commitDate = latest.date ? new Date(latest.date) : null;
    const relative = formatRelativeTime(commitDate);
    const shortHash = latest.hash ? latest.hash.slice(0, 7) : '';
    return relative ? `${shortHash} ${latest.message} (${relative})` : `${shortHash} ${latest.message}`;
  } catch (error) {
    return null;
  }
}

async function getGitStatusCounts() {
  try {
    const status = await git.status();
    const files = status?.files ?? [];
    if (files.length === 0) {
      return { staged: 0, unstaged: 0, untracked: 0, total: 0 };
    }

    let staged = 0;
    let unstaged = 0;
    let untracked = 0;

    for (const file of files) {
      const indexStatus = (file.index ?? '').trim();
      const worktreeStatus = (file.working_dir ?? '').trim();
      if (indexStatus === '?' && worktreeStatus === '?') {
        untracked += 1;
        continue;
      }
      if (indexStatus && indexStatus !== '?') {
        staged += 1;
      }
      if (worktreeStatus && worktreeStatus !== '?') {
        unstaged += 1;
      }
    }

    return { staged, unstaged, untracked, total: files.length };
  } catch (error) {
    return null;
  }
}

function section(title, icon) {
  const heading = icon ? `${icon} ${title}` : title;
  console.log(`\n${colors.section(heading)}`);
  console.log(colors.dim('-'.repeat(heading.length)));
}

async function getNodeModulePackages(dir) {
  const packages = [];
  try {
    const directory = await fs.promises.opendir(dir);
    for await (const entry of directory) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name.startsWith('.')) {
        continue;
      }
      if (entry.name === '.bin') {
        continue;
      }
      if (entry.name.startsWith('@')) {
        const scopeDir = await fs.promises.opendir(path.join(dir, entry.name));
        for await (const scopedEntry of scopeDir) {
          if (scopedEntry.isDirectory()) {
            packages.push({
              name: `${entry.name}/${scopedEntry.name}`,
              path: path.join(dir, entry.name, scopedEntry.name),
            });
          }
        }
      } else {
        packages.push({
          name: entry.name,
          path: path.join(dir, entry.name),
        });
      }
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  return packages;
}

async function getLargestNodeModulePackages(dir, pathFilter, limit = 8) {
  const packages = await getNodeModulePackages(dir);
  if (packages.length === 0) {
    return [];
  }

  const results = [];
  let index = 0;
  const concurrency = Math.min(6, packages.length);

  async function worker() {
    while (index < packages.length) {
      const currentIndex = index;
      index += 1;
      const pkg = packages[currentIndex];
      const stats = await getDirectoryStats(pkg.path, { includeCounts: false, pathFilter });
      if (stats?.size != null) {
        results.push({ name: pkg.name, size: stats.size });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  results.sort((a, b) => b.size - a.size);
  return results.slice(0, limit);
}

async function runNpm(args) {
  try {
    const { stdout } = await execFileAsync('npm', args, { cwd: rootDir });
    return stdout?.trim() ?? '';
  } catch (err) {
    // npm often uses non-zero exit codes for "found something" cases (e.g., outdated = 1)
    if (err && typeof err.stdout === 'string') {
      return err.stdout.trim();
    }
    return null; // truly failed to run npm
  }
}

function parseSemverMajor(v) {
  // minimal, tolerant parser
  if (!v) return null;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? Number(m[1]) : null;
}

function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((b - a) / MS));
}

async function getOutdatedPackages() {
  // Ask npm for outdated deps
  const stdout = await runNpm(['outdated', '--json']);
  if (!stdout) return null; // npm missing or command failed (e.g. no lockfile)
  let data = {};
  try {
    data = JSON.parse(stdout);
  } catch {
    return null;
  }
  const entries = Object.entries(data).map(([name, info]) => ({
    name,
    current: info.current,
    wanted: info.wanted,
    latest: info.latest,
    type: info.type, // 'dependencies' or 'devDependencies'
  }));
  if (entries.length === 0) return [];

  // For publish dates, query registry: npm view <pkg> time --json
  // This adds network round-trips; keep concurrency small.
  const concurrency = 4;
  let i = 0;
  const results = [];
  async function worker() {
    while (i < entries.length) {
      const idx = i++;
      const e = entries[idx];

      // Default metrics (even if registry call fails)
      const currentMajor = parseSemverMajor(e.current);
      const latestMajor = parseSemverMajor(e.latest);
      const majorLag = currentMajor != null && latestMajor != null ? Math.max(0, latestMajor - currentMajor) : null;

      let currentDate = null;
      let latestDate = null;
      const timesJson = await runNpm(['view', e.name, 'time', '--json']);
      if (timesJson) {
        try {
          const times = JSON.parse(timesJson); // { "1.0.0": "2019-...", "latest": ..., "modified": ... }
          currentDate = times[e.current] ? new Date(times[e.current]) : null;
          latestDate = times[e.latest] ? new Date(times[e.latest]) : null;
        } catch {
          // ignore parsing error, keep nulls
        }
      }

      let daysBehind = null;
      if (currentDate && latestDate) {
        daysBehind = daysBetween(currentDate, latestDate);
      }

      results.push({
        ...e,
        majorLag,
        daysBehind,
        currentDate,
        latestDate,
      });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
  return results;
}

function formatDate(d) {
  return d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : 'n/a';
}

async function getTopLevelInstalled() {
  // Uses npm to read installed top-level deps (node_modules + lockfile truth)
  const stdout = await runNpm(['ls', '--json', '--depth=0']);
  if (!stdout) return null;
  let data = {};
  try {
    data = JSON.parse(stdout);
  } catch {
    return null;
  }
  const deps = data.dependencies || {};
  const list = [];
  for (const [name, info] of Object.entries(deps)) {
    // Skip extraneous/invalid entries
    if (!info || typeof info !== 'object' || !info.version) continue;
    list.push({ name, version: info.version });
  }
  return list;
}

async function getPackageAgeInfo(packages) {
  // Fetch publish dates for each installed version, plus latest
  if (!packages || packages.length === 0) return [];
  const results = [];
  let i = 0;
  const concurrency = Math.min(4, packages.length);

  function safeDate(s) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function daysSince(d) {
    if (!d) return null;
    const MS = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.round((Date.now() - d.getTime()) / MS));
  }

  async function worker() {
    while (i < packages.length) {
      const idx = i++;
      const { name, version } = packages[idx];

      // 1) times for all versions
      const timesJson = await runNpm(['view', name, 'time', '--json']);
      let times = null;
      if (timesJson) {
        try {
          times = JSON.parse(timesJson);
        } catch {}
      }

      // 2) latest dist-tag (to avoid guessing)
      let latest = null;
      const latestJson = await runNpm(['view', name, 'dist-tags.latest', '--json']);
      if (latestJson) {
        try {
          latest = JSON.parse(latestJson);
        } catch {}
        if (typeof latest === 'string') {
          /* ok */
        } else {
          latest = null;
        }
      }

      const installedDate = times && times[version] ? safeDate(times[version]) : null;
      const latestDate = times && latest && times[latest] ? safeDate(times[latest]) : null;

      results.push({
        name,
        installed: version,
        latest: latest || version,
        installedDate,
        latestDate,
        installedAgeDays: daysSince(installedDate),
        latestAgeDays: daysSince(latestDate),
        isLatest: latest ? latest === version : null,
      });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function median(nums) {
  const arr = nums.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

export async function main() {
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const ignoreConfig = await loadIgnoreConfig(cliOptions.excludePatterns);
  const pathFilter = createPathFilter({
    gitMatcher: ignoreConfig.gitMatcher,
    excludeMatcher: ignoreConfig.excludeMatcher,
    includeCache: cliOptions.includeCache,
    appliesToNodeModules: ignoreConfig.appliesToNodeModules,
  });

  const pkg = await readPackageJson();
  const dependencyCount = Object.keys(pkg.dependencies || {}).length;
  const devDependencyCount = Object.keys(pkg.devDependencies || {}).length;
  const scriptCount = Object.keys(pkg.scripts || {}).length;

  console.log(colors.title('Framework Status Report'));
  console.log(colors.dim('========================'));

  section('Package', '📦');
  console.log(`Name: ${colors.value(pkg.name)}`);
  console.log(`Version: ${colors.value(pkg.version)}`);
  if (pkg.engines?.node) {
    console.log(`Required Node: ${colors.value(pkg.engines.node)}`);
  }
  console.log(`NPM scripts: ${colors.value(numberFormatter.format(scriptCount))}`);

  section('Dependencies', '📚');
  console.log(`Runtime: ${colors.value(numberFormatter.format(dependencyCount))}`);
  console.log(`Dev: ${colors.value(numberFormatter.format(devDependencyCount))}`);
  console.log(`Total: ${colors.value(numberFormatter.format(dependencyCount + devDependencyCount))}`);

  section('Repository', '🧭');
  const branch = await getGitBranch();
  const summary = await getGitSummary();
  const statusCounts = await getGitStatusCounts();

  console.log(`Branch: ${colors.value(branch ?? 'n/a')}`);
  console.log(`Last commit: ${colors.value(summary ?? 'n/a')}`);
  if (statusCounts) {
    const { total, staged, unstaged, untracked } = statusCounts;
    console.log(
      `Pending changes: ${colors.value(numberFormatter.format(total))} ` +
        colors.dim(
          `(staged ${numberFormatter.format(staged)}, ` +
            `unstaged ${numberFormatter.format(unstaged)}, ` +
            `untracked ${numberFormatter.format(untracked)})`,
        ),
    );
  } else {
    console.log('Pending changes: n/a');
  }

  section('Sizes', '📁');
  const dirsToInspect = [
    { label: 'src', path: path.join(rootDir, 'src'), includeCounts: true },
    { label: 'dist', path: path.join(rootDir, 'dist'), includeCounts: true },
    { label: 'node_modules', path: path.join(rootDir, 'node_modules'), includeCounts: false },
  ];

  for (const item of dirsToInspect) {
    const stats = await getDirectoryStats(item.path, {
      includeCounts: item.includeCounts,
      pathFilter,
    });
    if (!stats) {
      console.log(`${item.label}: not found`);
      continue;
    }
    const details = [`${item.label}: ${colors.value(formatBytes(stats.size))}`];
    if (item.includeCounts) {
      details.push(
        colors.dim(`(files ${numberFormatter.format(stats.files)}, dirs ${numberFormatter.format(stats.dirs)})`),
      );
    }
    console.log(details.join(' '));
  }

  const nodeModulesPackages = await getLargestNodeModulePackages(path.join(rootDir, 'node_modules'), pathFilter);
  if (nodeModulesPackages.length > 0) {
    section('Largest node_modules packages', '🧱');
    nodeModulesPackages.forEach((pkgInfo, index) => {
      console.log(`${index + 1}. ${pkgInfo.name} ${colors.dim('—')} ${colors.value(formatBytes(pkgInfo.size))}`);
    });
  }

  const outdated = await getOutdatedPackages();

  if (outdated === null) {
    section('Outdated npm packages', '⏳');
    console.log('Could not run `npm` (not in PATH, or blocked).');
    console.log(colors.dim('Tip: ensure Node/npm are installed and accessible in PATH.'));
  } else if (outdated.length === 0) {
    section('Outdated npm packages', '⏳');
    console.log('All dependencies are up to date 🎉');
  } else {
    // Two leaderboards: by age and by major version lag
    const byAge = outdated
      .filter(o => o.daysBehind != null)
      .sort((a, b) => b.daysBehind - a.daysBehind)
      .slice(0, 10);

    const byMajor = outdated
      .filter(o => o.majorLag != null)
      .sort((a, b) => b.majorLag - a.majorLag || (b.daysBehind ?? 0) - (a.daysBehind ?? 0))
      .slice(0, 10);

    section('Outdated npm packages — oldest by publish date', '⏳');
    if (byAge.length === 0) {
      console.log('No publish dates available to rank by age.');
    } else {
      byAge.forEach((o, idx) => {
        const line =
          `${idx + 1}. ${o.name} ` +
          `${colors.value(o.current)} → ${colors.value(o.latest)} ` +
          colors.dim(
            `(${o.type}, ${o.daysBehind} days behind; ` +
              `current: ${formatDate(o.currentDate)}, latest: ${formatDate(o.latestDate)})`,
          );
        console.log(line);
      });
    }

    section('Outdated npm packages — biggest major version lag', '⬆️');
    byMajor.forEach((o, idx) => {
      const lag = o.majorLag === 0 ? 'same major' : `${o.majorLag} major ${o.majorLag === 1 ? 'version' : 'versions'}`;
      const age = o.daysBehind != null ? `, ${o.daysBehind} days behind` : '';
      const line =
        `${idx + 1}. ${o.name} ` +
        `${colors.value(o.current)} → ${colors.value(o.latest)} ` +
        colors.dim(`(${o.type}, ${lag}${age})`);
      console.log(line);
    });

    // ------- Package age overview (includes non-outdated) -------
    const installed = await getTopLevelInstalled();

    section('Package ages — installed releases', '🕰️');
    if (!installed) {
      console.log('Could not read installed packages (npm ls failed).');
    } else if (installed.length === 0) {
      console.log('No top-level packages found.');
    } else {
      const ageInfo = await getPackageAgeInfo(installed);

      // Top N oldest installed releases by publish date
      const oldest = ageInfo
        .filter(p => p.installedAgeDays != null)
        .sort((a, b) => b.installedAgeDays - a.installedAgeDays || a.name.localeCompare(b.name))
        .slice(0, 10);

      if (oldest.length === 0) {
        console.log('No publish dates available to rank by age.');
      } else {
        oldest.forEach((p, idx) => {
          const latestNote =
            p.isLatest === true ? 'latest' : p.isLatest === false ? `latest ${p.latest}` : 'latest n/a';
          const line =
            `${idx + 1}. ${p.name} ` +
            `${colors.value(p.installed)} ` +
            colors.dim(
              `— released ${p.installedAgeDays} days ago ` + `(on ${formatDate(p.installedDate)}; ${latestNote})`,
            );
          console.log(line);
        });
      }

      // Quick stats across all packages with known dates
      const ages = ageInfo.map(p => p.installedAgeDays).filter(n => Number.isFinite(n));
      if (ages.length > 0) {
        const min = Math.min(...ages);
        const max = Math.max(...ages);
        const med = median(ages);
        const avg = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
        console.log(
          colors.dim(
            `\nInstalled release age — count ${ages.length}, min ${min}d, median ${med}d, avg ${avg}d, max ${max}d.`,
          ),
        );
      }
    }
  }
}

// Only execute automatically if run directly via CLI (e.g. `node scripts/framework-status.js`)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Failed to generate framework status report.');
    console.error(error);
    process.exitCode = 1;
  });
}

// Export selected internals for testing (kept minimal & stable-ish)
export { parseCliOptions, formatBytes, formatRelativeTime, loadIgnoreConfig, createPathFilter, getDirectoryStats };
