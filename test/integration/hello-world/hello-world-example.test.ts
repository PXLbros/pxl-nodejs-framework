import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { testServerRequest, waitForServer } from '../../utils/helpers/test-server.js';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Hello World Example End-to-End', () => {
  let backendProcess: ChildProcess;
  let testPort: number;
  const testHost = '127.0.0.1';
  let wsUrl: string;
  let baseUrl: string;
  let previousInMemoryRedisEnv: string | undefined;

  beforeAll(async () => {
    // Import test port helper
    const { getTestPort } = await import('../../utils/helpers/test-server.js');
    testPort = getTestPort();
    wsUrl = `ws://${testHost}:${testPort}/ws`;
    baseUrl = `http://${testHost}:${testPort}`;

    // Path to the hello-world backend
    const backendPath = path.join(__dirname, '../../../examples/hello-world/backend');
    const indexPath = path.join(backendPath, 'src/index.ts');

    // Set environment variables for the test
    const env = {
      ...process.env,
      PORT: testPort.toString(),
      HOST: testHost,
      NODE_ENV: 'integration-test',
      PXL_REDIS_IN_MEMORY: 'true',
      DB_ENABLED: 'false',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: 'postgres',
      DB_DATABASE_NAME: 'hello_world',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      JWT_SECRET: 'test-secret-key',
    };

    // Start the backend process
    backendProcess = spawn('npx', ['tsx', indexPath], {
      cwd: backendPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    previousInMemoryRedisEnv = process.env.PXL_REDIS_IN_MEMORY;
    process.env.PXL_REDIS_IN_MEMORY = 'true';

    // Collect output for debugging
    let stdout = '';
    let stderr = '';
    backendProcess.stdout?.on('data', data => {
      const text = data.toString();
      stdout += text;
      if (process.env.DEBUG_TESTS) {
        console.log('[BACKEND]', text);
      }
    });
    backendProcess.stderr?.on('data', data => {
      const text = data.toString();
      stderr += text;
      if (process.env.DEBUG_TESTS) {
        console.error('[BACKEND ERROR]', text);
      }
    });

    // Handle process errors
    backendProcess.on('error', error => {
      console.error('Failed to start backend process:', error);
      console.error('STDOUT:', stdout);
      console.error('STDERR:', stderr);
    });

    backendProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`Backend process exited with code ${code}`);
        console.error('STDOUT:', stdout);
        console.error('STDERR:', stderr);
      }
    });

    // Wait for server to be ready (timeout is auto-adjusted for CI environments)
    try {
      await waitForServer(testPort);
      // Give it an extra moment to fully initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Server failed to start. STDOUT:', stdout);
      console.error('Server failed to start. STDERR:', stderr);
      throw error;
    }
  }, 75000); // Increased timeout to accommodate CI environments (60s wait + 15s buffer)

  afterAll(async () => {
    if (backendProcess) {
      // Send SIGTERM and wait for graceful shutdown
      backendProcess.kill('SIGTERM');

      // Wait for process to exit with timeout
      const exitPromise = new Promise<void>(resolve => {
        backendProcess.once('exit', () => resolve());
      });

      const timeoutPromise = new Promise<void>(resolve => setTimeout(resolve, 3000));

      await Promise.race([exitPromise, timeoutPromise]);

      // If still running after timeout, force kill
      if (backendProcess.exitCode === null) {
        console.warn('Process did not exit gracefully, forcing SIGKILL');
        backendProcess.kill('SIGKILL');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (previousInMemoryRedisEnv === undefined) {
      delete process.env.PXL_REDIS_IN_MEMORY;
    } else {
      process.env.PXL_REDIS_IN_MEMORY = previousInMemoryRedisEnv;
    }
  }, 10000);

  describe('REST API Endpoints', () => {
    it('should respond to GET /api/ping', async () => {
      const response = await testServerRequest(testPort, '/api/ping');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
      expect(response.data).toHaveProperty('message', 'pong');
      expect(response.data).toHaveProperty('timestamp');
      expect(new Date(response.data.timestamp)).toBeInstanceOf(Date);
    });

    it('should respond to POST /api/hello with name', async () => {
      const response = await testServerRequest(testPort, '/api/hello', {
        method: 'POST',
        data: { name: 'Alice' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Hello, Alice!');
      expect(response.data).toHaveProperty('receivedName', 'Alice');
      expect(response.data).toHaveProperty('timestamp');
    });

    it('should respond to POST /api/hello without name', async () => {
      const response = await testServerRequest(testPort, '/api/hello', {
        method: 'POST',
        data: {},
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Hello, World!');
      expect(response.data).toHaveProperty('receivedName', 'World');
    });

    it('should handle special characters in name', async () => {
      const response = await testServerRequest(testPort, '/api/hello', {
        method: 'POST',
        data: { name: 'José María' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('message', 'Hello, José María!');
      expect(response.data).toHaveProperty('receivedName', 'José María');
    });

    it('should respond to GET /api/info', async () => {
      const response = await testServerRequest(testPort, '/api/info');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('name', 'PXL Framework - Hello World API');
      expect(response.data).toHaveProperty('version', '1.0.0');
      expect(response.data).toHaveProperty('framework', '@scpxl/nodejs-framework');
      expect(response.data).toHaveProperty('endpoints');
      expect(Array.isArray(response.data.endpoints)).toBe(true);
      expect(response.data.endpoints.length).toBeGreaterThanOrEqual(3);
    });

    it('should return 404 for unknown routes', async () => {
      const response = await testServerRequest(testPort, '/api/unknown');
      expect(response.status).toBe(404);
    });

    it('should include CORS headers', async () => {
      const response = await testServerRequest(testPort, '/api/ping', {
        headers: {
          Origin: 'http://localhost:5173',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('WebSocket Functionality', () => {
    it('should accept WebSocket connections', async () => {
      const ws = new WebSocket(wsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it.skip('should receive connection message', async () => {
      const ws = new WebSocket(wsUrl);

      // The framework sends multiple messages on connection (system + custom)
      // We need to collect all messages and find the hello one
      const messages: any[] = [];

      const connectionMessage = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Connection message timeout. Received messages: ${JSON.stringify(messages)}`));
        }, 5000);

        ws.on('message', data => {
          const message = JSON.parse(data.toString());
          messages.push(message);

          // Look for the hello/connected message
          if (message.type === 'hello' && message.action === 'connected') {
            clearTimeout(timeout);
            resolve(message);
          }
        });

        ws.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(connectionMessage).toHaveProperty('type', 'hello');
      expect(connectionMessage).toHaveProperty('action', 'connected');
      expect(connectionMessage.data).toHaveProperty('message');
      expect(connectionMessage.data).toHaveProperty('clientId');
      expect(connectionMessage.data.message).toContain('Connected');

      ws.close();
    });

    it.skip('should broadcast greetings to all clients', async () => {
      const client1 = new WebSocket(wsUrl);
      const client2 = new WebSocket(wsUrl);

      // Wait for both connections
      await Promise.all([
        new Promise<void>(resolve => client1.on('open', () => resolve())),
        new Promise<void>(resolve => client2.on('open', () => resolve())),
      ]);

      // Wait for connection messages to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Set up message collectors AFTER connection messages
      const client1Greetings: any[] = [];
      const client2Greetings: any[] = [];

      const greetingReceived = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Greeting not received. Client1: ${client1Greetings.length}, Client2: ${client2Greetings.length}`,
            ),
          );
        }, 3000);

        let receivedCount = 0;
        const checkBoth = () => {
          receivedCount++;
          if (receivedCount >= 2) {
            clearTimeout(timeout);
            resolve();
          }
        };

        client1.on('message', data => {
          const message = JSON.parse(data.toString());
          if (message.type === 'hello' && message.action === 'greeting') {
            client1Greetings.push(message);
            checkBoth();
          }
        });

        client2.on('message', data => {
          const message = JSON.parse(data.toString());
          if (message.type === 'hello' && message.action === 'greeting') {
            client2Greetings.push(message);
            checkBoth();
          }
        });
      });

      // Send a greeting
      client1.send(
        JSON.stringify({
          type: 'hello',
          action: 'greet',
          data: {
            name: 'Test User',
            message: 'Hello from test!',
          },
        }),
      );

      // Wait for both clients to receive the greeting
      await greetingReceived;

      // Both clients should have received the broadcast
      expect(client1Greetings.length).toBeGreaterThanOrEqual(1);
      expect(client2Greetings.length).toBeGreaterThanOrEqual(1);

      const greeting = client1Greetings[0];
      expect(greeting).toHaveProperty('type', 'hello');
      expect(greeting).toHaveProperty('action', 'greeting');
      expect(greeting.data).toHaveProperty('name', 'Test User');
      expect(greeting.data).toHaveProperty('message', 'Hello from test!');
      expect(greeting.data).toHaveProperty('clientId');

      client1.close();
      client2.close();
    }, 10000);
  });
});
