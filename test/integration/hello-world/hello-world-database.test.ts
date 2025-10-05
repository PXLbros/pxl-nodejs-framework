import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { testServerRequest, waitForServer, getTestPort } from '../../utils/helpers/test-server.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Hello World Database CRUD', () => {
  let backendProcess: ChildProcess;
  let testPort: number;
  const testHost = '127.0.0.1';

  // Check if database is enabled via environment variable
  const dbEnabled = process.env.TEST_DB_ENABLED === 'true';

  beforeAll(async () => {
    if (!dbEnabled) {
      console.log('Skipping database tests - TEST_DB_ENABLED is not true');
      return;
    }

    testPort = getTestPort();

    // Path to the hello-world backend
    const backendPath = path.join(__dirname, '../../../examples/hello-world/backend');
    const indexPath = path.join(backendPath, 'src/index.ts');

    // Set environment variables for the test with database enabled
    const env = {
      ...process.env,
      PORT: testPort.toString(),
      HOST: testHost,
      NODE_ENV: 'integration-test',
      DB_ENABLED: 'true',
      DB_HOST: process.env.TEST_DB_HOST || 'localhost',
      DB_PORT: process.env.TEST_DB_PORT || '5432',
      DB_USERNAME: process.env.TEST_DB_USERNAME || 'postgres',
      DB_PASSWORD: process.env.TEST_DB_PASSWORD || 'postgres',
      DB_DATABASE_NAME: process.env.TEST_DB_DATABASE_NAME || 'hello_world_test',
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

    // Collect output for debugging
    let stdout = '';
    let stderr = '';
    backendProcess.stdout?.on('data', data => {
      stdout += data.toString();
      if (process.env.DEBUG_TESTS) {
        console.log('[DB BACKEND]', data.toString());
      }
    });
    backendProcess.stderr?.on('data', data => {
      stderr += data.toString();
      if (process.env.DEBUG_TESTS) {
        console.error('[DB BACKEND ERROR]', data.toString());
      }
    });

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

    // Wait for server to be ready
    try {
      await waitForServer(testPort, 30000);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Server failed to start. STDOUT:', stdout);
      console.error('STDERR:', stderr);
      throw error;
    }
  }, 40000);

  afterAll(async () => {
    if (backendProcess && dbEnabled) {
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
  }, 10000);

  describe('Greetings CRUD Operations', () => {
    let createdGreetingId: number;

    it.skipIf(!dbEnabled)('should create a new greeting', async () => {
      const response = await testServerRequest(testPort, '/api/greetings', {
        method: 'POST',
        data: {
          name: 'Test User',
          message: 'Hello from test!',
        },
      });

      expect(response.status).toBe(201);
      expect(response.data.greeting).toHaveProperty('id');
      expect(response.data.greeting).toHaveProperty('name', 'Test User');
      expect(response.data.greeting).toHaveProperty('message', 'Hello from test!');
      expect(response.data.greeting).toHaveProperty('createdAt');
      expect(response.data.greeting).toHaveProperty('updatedAt');

      // Save the ID for subsequent tests
      createdGreetingId = response.data.greeting.id;
    });

    it.skipIf(!dbEnabled)('should return 400 when creating without required fields', async () => {
      const response = await testServerRequest(testPort, '/api/greetings', {
        method: 'POST',
        data: {
          name: 'Test User',
          // missing message
        },
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });

    it.skipIf(!dbEnabled)('should list all greetings', async () => {
      const response = await testServerRequest(testPort, '/api/greetings');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('greetings');
      expect(Array.isArray(response.data.greetings)).toBe(true);
      expect(response.data.greetings.length).toBeGreaterThan(0);
    });

    it.skipIf(!dbEnabled)('should get a specific greeting by ID', async () => {
      if (!createdGreetingId) {
        // Create one if we don't have an ID
        const createResponse = await testServerRequest(testPort, '/api/greetings', {
          method: 'POST',
          data: { name: 'Test', message: 'Test message' },
        });
        createdGreetingId = createResponse.data.greeting.id;
      }

      const response = await testServerRequest(testPort, `/api/greetings/${createdGreetingId}`);

      expect(response.status).toBe(200);
      expect(response.data.greeting).toHaveProperty('id', createdGreetingId);
      expect(response.data.greeting).toHaveProperty('name');
      expect(response.data.greeting).toHaveProperty('message');
    });

    it.skipIf(!dbEnabled)('should return 404 for non-existent greeting', async () => {
      const response = await testServerRequest(testPort, '/api/greetings/999999');

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });

    it.skipIf(!dbEnabled)('should update a greeting', async () => {
      if (!createdGreetingId) {
        const createResponse = await testServerRequest(testPort, '/api/greetings', {
          method: 'POST',
          data: { name: 'Test', message: 'Test message' },
        });
        createdGreetingId = createResponse.data.greeting.id;
      }

      const response = await testServerRequest(testPort, `/api/greetings/${createdGreetingId}`, {
        method: 'PUT',
        data: {
          name: 'Updated User',
          message: 'Updated message!',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.greeting).toHaveProperty('id', createdGreetingId);
      expect(response.data.greeting).toHaveProperty('name', 'Updated User');
      expect(response.data.greeting).toHaveProperty('message', 'Updated message!');
    });

    it.skipIf(!dbEnabled)('should partially update a greeting', async () => {
      if (!createdGreetingId) {
        const createResponse = await testServerRequest(testPort, '/api/greetings', {
          method: 'POST',
          data: { name: 'Test', message: 'Test message' },
        });
        createdGreetingId = createResponse.data.greeting.id;
      }

      // Update only the message
      const response = await testServerRequest(testPort, `/api/greetings/${createdGreetingId}`, {
        method: 'PUT',
        data: {
          message: 'Only message updated',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.greeting).toHaveProperty('message', 'Only message updated');
    });

    it.skipIf(!dbEnabled)('should return 404 when updating non-existent greeting', async () => {
      const response = await testServerRequest(testPort, '/api/greetings/999999', {
        method: 'PUT',
        data: {
          name: 'Test',
          message: 'Test',
        },
      });

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });

    it.skipIf(!dbEnabled)('should delete a greeting', async () => {
      // Create a greeting specifically for deletion
      const createResponse = await testServerRequest(testPort, '/api/greetings', {
        method: 'POST',
        data: {
          name: 'To Delete',
          message: 'This will be deleted',
        },
      });

      const idToDelete = createResponse.data.greeting.id;

      // Delete it
      const deleteResponse = await testServerRequest(testPort, `/api/greetings/${idToDelete}`, {
        method: 'DELETE',
      });

      expect(deleteResponse.status).toBe(204);

      // Verify it's deleted
      const getResponse = await testServerRequest(testPort, `/api/greetings/${idToDelete}`);
      expect(getResponse.status).toBe(404);
    });

    it.skipIf(!dbEnabled)('should return 404 when deleting non-existent greeting', async () => {
      const response = await testServerRequest(testPort, '/api/greetings/999999', {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('error');
    });
  });
});
