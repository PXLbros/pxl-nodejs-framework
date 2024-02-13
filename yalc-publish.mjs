import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';

const execAsync = promisify(exec);

async function publish() {
  try {
    await execAsync('yalc publish');

    const packageJsonRaw = await readFile('./package.json', { encoding: 'utf8' });
    const packageJson = JSON.parse(packageJsonRaw);
    const packageName = packageJson.name;

    const { stdout } = await execAsync(`yalc installations show ${packageName}`);

    const matches = stdout.matchAll(/^\s*(\/[\S]+)/gm);

    const installationDirectories = Array.from(matches, (m) => m[1]);

    for (const installationDirectory of installationDirectories) {
      console.log(`Run update in ${installationDirectory}`);

      await execAsync(`cd ${installationDirectory} && yalc update`);
    }

    console.log('Done!');
  } catch (error) {
    console.error(error);
  }
}

publish();
