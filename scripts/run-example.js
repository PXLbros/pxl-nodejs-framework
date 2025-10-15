#!/usr/bin/env node
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const [, , ...cliArgsRaw] = process.argv;
const cliArgs = cliArgsRaw.filter(arg => arg !== '--');
const [exampleArg, ...restArgs] = cliArgs;

const example = exampleArg ?? process.env.PXL_EXAMPLE ?? process.env.npm_config_example ?? 'hello-world/backend';

const examplePath = path.resolve(process.cwd(), 'examples', example);

if (!fs.existsSync(examplePath)) {
  console.error(`[pxl] Example directory not found: ${examplePath}`);
  process.exit(1);
}

const packageJsonPath = path.join(examplePath, 'package.json');

let packageJson;
try {
  const packageRaw = fs.readFileSync(packageJsonPath, 'utf8');
  packageJson = JSON.parse(packageRaw);
} catch (error) {
  console.error(`[pxl] Failed to read example package.json at ${packageJsonPath}:`, error);
  process.exit(1);
}

const scripts = packageJson?.scripts ?? {};
const targetScript = scripts.dev ? 'dev' : scripts.start ? 'start' : null;

if (!targetScript) {
  console.error('[pxl] Example package.json must define either a "dev" or "start" script.');
  process.exit(1);
}

console.log(
  `[pxl] Running example "${example}" with npm run ${targetScript} (watch mode ${targetScript === 'dev' ? 'enabled' : 'disabled'})`,
);

const npmArgs = ['run', targetScript, '--prefix', examplePath];
if (restArgs.length > 0) {
  npmArgs.push('--', ...restArgs);
}

const child = spawn('npm', npmArgs, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', code => {
  process.exit(code ?? 0);
});
