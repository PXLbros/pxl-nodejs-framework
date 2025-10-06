import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';

describe('Cluster Integration Tests', () => {
  let testAppPath: string;
  let childProcess: ChildProcess | null = null;
  const testDir = join(process.cwd(), 'test', 'integration', 'cluster', 'fixtures');

  beforeEach(() => {
    // Create test fixtures directory if it doesn't exist
    try {
      mkdirSync(testDir, { recursive: true });
    } catch (e) {
      // Directory already exists
    }
  });

  afterEach(() => {
    // Clean up spawned process
    if (childProcess && !childProcess.killed) {
      childProcess.kill('SIGTERM');
      childProcess = null;
    }

    // Clean up test files
    if (testAppPath) {
      try {
        unlinkSync(testAppPath);
      } catch (e) {
        // File may not exist
      }
    }
  });

  it('should start cluster with multiple workers in auto mode', async () => {
    testAppPath = join(testDir, 'test-cluster-auto.js');

    // Create a simple clustered application
    const appCode = `
      import cluster from 'cluster';
      import { cpus } from 'os';

      if (cluster.isPrimary) {
        const numWorkers = cpus().length;
        console.log(JSON.stringify({ type: 'primary-start', workerCount: numWorkers }));

        for (let i = 0; i < numWorkers; i++) {
          cluster.fork();
        }

        cluster.on('online', (worker) => {
          console.log(JSON.stringify({ type: 'worker-online', id: worker.id }));
        });

        setTimeout(() => {
          console.log(JSON.stringify({ type: 'test-complete' }));
          process.exit(0);
        }, 2000);
      } else {
        console.log(JSON.stringify({ type: 'worker-started', id: cluster.worker.id }));
      }
    `;

    writeFileSync(testAppPath, appCode);

    const messages: any[] = [];

    await new Promise<void>((resolve, reject) => {
      childProcess = spawn('node', [testAppPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timeout = setTimeout(() => {
        reject(new Error('Test timeout'));
      }, 5000);

      childProcess.stdout?.on('data', data => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
          try {
            const msg = JSON.parse(line);
            messages.push(msg);
          } catch (e) {
            // Ignore non-JSON output
          }
        });
      });

      childProcess.on('exit', code => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      childProcess.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const primaryStart = messages.find(m => m.type === 'primary-start');
    expect(primaryStart).toBeDefined();
    expect(primaryStart?.workerCount).toBeGreaterThan(0);

    const workerOnline = messages.filter(m => m.type === 'worker-online');
    expect(workerOnline.length).toBe(primaryStart?.workerCount);

    const testComplete = messages.find(m => m.type === 'test-complete');
    expect(testComplete).toBeDefined();
  });

  it('should handle graceful shutdown with SIGTERM', async () => {
    testAppPath = join(testDir, 'test-cluster-shutdown.js');

    const appCode = `
      import cluster from 'cluster';

      let isShuttingDown = false;

      if (cluster.isPrimary) {
        console.log(JSON.stringify({ type: 'primary-start' }));

        for (let i = 0; i < 2; i++) {
          cluster.fork();
        }

        let exitedWorkers = 0;

        process.on('SIGTERM', () => {
          if (isShuttingDown) return;
          isShuttingDown = true;

          console.log(JSON.stringify({ type: 'primary-shutdown-start' }));

          Object.values(cluster.workers ?? {}).forEach(worker => {
            if (worker) {
              worker.send('shutdown');
            }
          });

          cluster.on('exit', () => {
            exitedWorkers++;
            console.log(JSON.stringify({ type: 'worker-exited', exitedWorkers }));

            if (exitedWorkers === 2) {
              console.log(JSON.stringify({ type: 'all-workers-exited' }));
              process.exit(0);
            }
          });
        });

        cluster.on('online', (worker) => {
          console.log(JSON.stringify({ type: 'worker-online', id: worker.id }));
        });
      } else {
        console.log(JSON.stringify({ type: 'worker-started', id: cluster.worker.id }));

        process.on('message', async (msg) => {
          if (msg === 'shutdown') {
            console.log(JSON.stringify({ type: 'worker-shutdown', id: cluster.worker.id }));
            setTimeout(() => process.exit(0), 100);
          }
        });
      }
    `;

    writeFileSync(testAppPath, appCode);

    const messages: any[] = [];

    await new Promise<void>((resolve, reject) => {
      childProcess = spawn('node', [testAppPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timeout = setTimeout(() => {
        reject(new Error('Test timeout'));
      }, 5000);

      childProcess.stdout?.on('data', data => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
          try {
            const msg = JSON.parse(line);
            messages.push(msg);

            // Once both workers are online, send SIGTERM
            if (msg.type === 'worker-online') {
              const onlineWorkers = messages.filter(m => m.type === 'worker-online');
              if (onlineWorkers.length === 2) {
                setTimeout(() => {
                  if (childProcess) {
                    childProcess.kill('SIGTERM');
                  }
                }, 500);
              }
            }
          } catch (e) {
            // Ignore non-JSON output
          }
        });
      });

      childProcess.on('exit', code => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      childProcess.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    expect(messages.find(m => m.type === 'primary-start')).toBeDefined();
    expect(messages.find(m => m.type === 'primary-shutdown-start')).toBeDefined();
    expect(messages.filter(m => m.type === 'worker-exited').length).toBe(2);
    expect(messages.find(m => m.type === 'all-workers-exited')).toBeDefined();
  });

  it('should restart workers on unexpected exit', async () => {
    testAppPath = join(testDir, 'test-cluster-restart.js');

    const appCode = `
      import cluster from 'cluster';

      if (cluster.isPrimary) {
        console.log(JSON.stringify({ type: 'primary-start' }));

        cluster.fork();

        let restartCount = 0;

        cluster.on('exit', (worker) => {
          console.log(JSON.stringify({ type: 'worker-died', id: worker.id }));

          if (restartCount < 1) {
            restartCount++;
            console.log(JSON.stringify({ type: 'restarting-worker' }));
            cluster.fork();
          } else {
            console.log(JSON.stringify({ type: 'test-complete' }));
            process.exit(0);
          }
        });

        cluster.on('online', (worker) => {
          console.log(JSON.stringify({ type: 'worker-online', id: worker.id }));
        });
      } else {
        console.log(JSON.stringify({ type: 'worker-started', id: cluster.worker.id }));

        // First worker crashes after 500ms
        setTimeout(() => {
          console.log(JSON.stringify({ type: 'worker-crashing', id: cluster.worker.id }));
          process.exit(1);
        }, 500);
      }
    `;

    writeFileSync(testAppPath, appCode);

    const messages: any[] = [];

    await new Promise<void>((resolve, reject) => {
      childProcess = spawn('node', [testAppPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timeout = setTimeout(() => {
        reject(new Error('Test timeout'));
      }, 5000);

      childProcess.stdout?.on('data', data => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
          try {
            const msg = JSON.parse(line);
            messages.push(msg);
          } catch (e) {
            // Ignore non-JSON output
          }
        });
      });

      childProcess.on('exit', code => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      childProcess.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    expect(messages.find(m => m.type === 'worker-died')).toBeDefined();
    expect(messages.find(m => m.type === 'restarting-worker')).toBeDefined();
    expect(messages.filter(m => m.type === 'worker-online').length).toBe(2); // Original + restarted
    expect(messages.find(m => m.type === 'test-complete')).toBeDefined();
  });
});
