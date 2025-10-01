import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRequestContext,
  getRequestId,
  getUserId,
  setUserId,
  getContextMetadata,
  setContextMetadata,
  runWithContext,
  runWithContextAsync,
} from '../../../src/request-context/request-context.js';

describe('Request Context', () => {
  describe('getRequestContext', () => {
    it('should return undefined when not in a request context', () => {
      expect(getRequestContext()).toBeUndefined();
    });

    it('should return context when in a request context', () => {
      runWithContext({}, () => {
        const context = getRequestContext();
        expect(context).toBeDefined();
        expect(context?.requestId).toBeDefined();
      });
    });
  });

  describe('getRequestId', () => {
    it('should return undefined when not in a request context', () => {
      expect(getRequestId()).toBeUndefined();
    });

    it('should return request ID when in a request context', () => {
      runWithContext({}, () => {
        const requestId = getRequestId();
        expect(requestId).toBeDefined();
        expect(typeof requestId).toBe('string');
        expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    it('should use provided request ID', () => {
      const customId = 'custom-request-id-123';
      runWithContext({ requestId: customId }, () => {
        expect(getRequestId()).toBe(customId);
      });
    });
  });

  describe('runWithContext', () => {
    it('should execute function within context', () => {
      let capturedId: string | undefined;

      runWithContext({}, () => {
        capturedId = getRequestId();
      });

      expect(capturedId).toBeDefined();
    });

    it('should generate unique request IDs for each context', () => {
      let id1: string | undefined;
      let id2: string | undefined;

      runWithContext({}, () => {
        id1 = getRequestId();
      });

      runWithContext({}, () => {
        id2 = getRequestId();
      });

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should return function result', () => {
      const result = runWithContext({}, () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it('should propagate context through nested function calls', () => {
      function innerFunction(): string | undefined {
        return getRequestId();
      }

      const result = runWithContext({ requestId: 'test-id' }, () => {
        return innerFunction();
      });

      expect(result).toBe('test-id');
    });

    it('should isolate contexts across concurrent executions', () => {
      const ids: (string | undefined)[] = [];

      runWithContext({ requestId: 'id-1' }, () => {
        ids.push(getRequestId());
      });

      runWithContext({ requestId: 'id-2' }, () => {
        ids.push(getRequestId());
      });

      expect(ids).toEqual(['id-1', 'id-2']);
    });
  });

  describe('runWithContextAsync', () => {
    it('should execute async function within context', async () => {
      let capturedId: string | undefined;

      await runWithContextAsync({}, async () => {
        await Promise.resolve();
        capturedId = getRequestId();
      });

      expect(capturedId).toBeDefined();
    });

    it('should return async function result', async () => {
      const result = await runWithContextAsync({}, async () => {
        await Promise.resolve();
        return 42;
      });

      expect(result).toBe(42);
    });

    it('should propagate context through async operations', async () => {
      async function innerAsyncFunction(): Promise<string | undefined> {
        await Promise.resolve();
        return getRequestId();
      }

      const result = await runWithContextAsync({ requestId: 'async-test-id' }, async () => {
        return await innerAsyncFunction();
      });

      expect(result).toBe('async-test-id');
    });

    it('should handle errors in async functions', async () => {
      await expect(async () => {
        await runWithContextAsync({}, async () => {
          throw new Error('Test error');
        });
      }).rejects.toThrow('Test error');
    });

    it('should propagate context through Promise chains', async () => {
      const result = await runWithContextAsync({ requestId: 'chain-test' }, async () => {
        return Promise.resolve()
          .then(() => getRequestId())
          .then(id => `ID: ${id}`);
      });

      expect(result).toBe('ID: chain-test');
    });

    it('should propagate context through setTimeout', async () => {
      const result = await runWithContextAsync({ requestId: 'timeout-test' }, async () => {
        return new Promise<string | undefined>(resolve => {
          setTimeout(() => {
            resolve(getRequestId());
          }, 10);
        });
      });

      expect(result).toBe('timeout-test');
    });
  });

  describe('userId management', () => {
    it('should return undefined when user ID is not set', () => {
      runWithContext({}, () => {
        expect(getUserId()).toBeUndefined();
      });
    });

    it('should store and retrieve user ID within context', () => {
      runWithContext({}, () => {
        setUserId('user-123');
        expect(getUserId()).toBe('user-123');
      });
    });

    it('should use provided user ID in options', () => {
      runWithContext({ userId: 'user-456' }, () => {
        expect(getUserId()).toBe('user-456');
      });
    });

    it('should update user ID in existing context', () => {
      runWithContext({ userId: 'initial-user' }, () => {
        expect(getUserId()).toBe('initial-user');
        setUserId('updated-user');
        expect(getUserId()).toBe('updated-user');
      });
    });

    it('should not persist user ID outside context', () => {
      runWithContext({}, () => {
        setUserId('context-user');
      });

      expect(getUserId()).toBeUndefined();
    });

    it('should isolate user IDs across contexts', () => {
      let userId1: string | undefined;
      let userId2: string | undefined;

      runWithContext({ userId: 'user-1' }, () => {
        userId1 = getUserId();
      });

      runWithContext({ userId: 'user-2' }, () => {
        userId2 = getUserId();
      });

      expect(userId1).toBe('user-1');
      expect(userId2).toBe('user-2');
    });
  });

  describe('metadata management', () => {
    it('should store and retrieve metadata', () => {
      runWithContext({}, () => {
        setContextMetadata('key1', 'value1');
        setContextMetadata('key2', 42);
        setContextMetadata('key3', { nested: true });

        expect(getContextMetadata('key1')).toBe('value1');
        expect(getContextMetadata('key2')).toBe(42);
        expect(getContextMetadata('key3')).toEqual({ nested: true });
      });
    });

    it('should return undefined for non-existent metadata keys', () => {
      runWithContext({}, () => {
        expect(getContextMetadata('non-existent')).toBeUndefined();
      });
    });

    it('should use provided metadata in options', () => {
      runWithContext({ metadata: { initial: 'value' } }, () => {
        expect(getContextMetadata('initial')).toBe('value');
      });
    });

    it('should update metadata in existing context', () => {
      runWithContext({ metadata: { key: 'initial' } }, () => {
        expect(getContextMetadata('key')).toBe('initial');
        setContextMetadata('key', 'updated');
        expect(getContextMetadata('key')).toBe('updated');
      });
    });

    it('should add new metadata keys to existing context', () => {
      runWithContext({ metadata: { key1: 'value1' } }, () => {
        setContextMetadata('key2', 'value2');
        expect(getContextMetadata('key1')).toBe('value1');
        expect(getContextMetadata('key2')).toBe('value2');
      });
    });

    it('should not persist metadata outside context', () => {
      runWithContext({}, () => {
        setContextMetadata('temp', 'value');
      });

      expect(getContextMetadata('temp')).toBeUndefined();
    });

    it('should isolate metadata across contexts', () => {
      let meta1: unknown;
      let meta2: unknown;

      runWithContext({}, () => {
        setContextMetadata('data', 'context-1');
        meta1 = getContextMetadata('data');
      });

      runWithContext({}, () => {
        setContextMetadata('data', 'context-2');
        meta2 = getContextMetadata('data');
      });

      expect(meta1).toBe('context-1');
      expect(meta2).toBe('context-2');
    });

    it('should handle complex metadata values', () => {
      runWithContext({}, () => {
        const complexValue = {
          array: [1, 2, 3],
          nested: { deep: { value: 'test' } },
          nullValue: null,
          undefinedValue: undefined,
        };

        setContextMetadata('complex', complexValue);
        expect(getContextMetadata('complex')).toEqual(complexValue);
      });
    });
  });

  describe('startTime management', () => {
    it('should store and retrieve start time', () => {
      const startTime = performance.now();
      runWithContext({ startTime }, () => {
        const context = getRequestContext();
        expect(context?.startTime).toBe(startTime);
      });
    });

    it('should allow undefined start time', () => {
      runWithContext({}, () => {
        const context = getRequestContext();
        expect(context?.startTime).toBeUndefined();
      });
    });
  });

  describe('context isolation', () => {
    it('should not leak context between sequential executions', () => {
      let id1: string | undefined;
      let id2OutsideContext: string | undefined;
      let id3: string | undefined;

      runWithContext({ requestId: 'first' }, () => {
        id1 = getRequestId();
      });

      id2OutsideContext = getRequestId();

      runWithContext({ requestId: 'second' }, () => {
        id3 = getRequestId();
      });

      expect(id1).toBe('first');
      expect(id2OutsideContext).toBeUndefined();
      expect(id3).toBe('second');
    });

    it('should handle nested contexts correctly', () => {
      const results: (string | undefined)[] = [];

      runWithContext({ requestId: 'outer' }, () => {
        results.push(getRequestId());

        runWithContext({ requestId: 'inner' }, () => {
          results.push(getRequestId());
        });

        results.push(getRequestId());
      });

      expect(results).toEqual(['outer', 'inner', 'outer']);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from synchronous functions', () => {
      expect(() => {
        runWithContext({}, () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');
    });

    it('should propagate errors from async functions', async () => {
      await expect(async () => {
        await runWithContextAsync({}, async () => {
          throw new Error('Async test error');
        });
      }).rejects.toThrow('Async test error');
    });

    it('should maintain context when errors are caught', () => {
      let requestId: string | undefined;

      runWithContext({ requestId: 'error-test' }, () => {
        try {
          throw new Error('Caught error');
        } catch {
          requestId = getRequestId();
        }
      });

      expect(requestId).toBe('error-test');
    });
  });
});
