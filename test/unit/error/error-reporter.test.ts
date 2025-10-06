import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ErrorReporter,
  ErrorCode,
  ErrorSeverity,
  FrameworkError,
  safeSerializeError,
} from '../../../src/error/index.js';
import { runWithContext } from '../../../src/request-context/index.js';

describe('ErrorReporter', () => {
  let errorReporter: ErrorReporter;

  beforeEach(() => {
    errorReporter = ErrorReporter.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ErrorReporter.getInstance();
      const instance2 = ErrorReporter.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('report', () => {
    it('should normalize and return error envelope for Error instances', () => {
      const error = new Error('Test error');
      const envelope = errorReporter.report(error);

      expect(envelope.message).toBe('Test error');
      expect(envelope.code).toBe(ErrorCode.UNKNOWN);
      expect(envelope.severity).toBe(ErrorSeverity.ERROR);
      expect(envelope.timestamp).toBeInstanceOf(Date);
    });

    it('should normalize and return error envelope for string errors', () => {
      const envelope = errorReporter.report('String error message');

      expect(envelope.message).toBe('String error message');
      expect(envelope.code).toBe(ErrorCode.UNKNOWN);
      expect(envelope.severity).toBe(ErrorSeverity.ERROR);
    });

    it('should handle FrameworkError instances correctly', () => {
      const error = new FrameworkError('Framework error', {
        code: ErrorCode.DATABASE_CONNECTION_FAILED,
        severity: ErrorSeverity.CRITICAL,
        context: { connectionPool: 'main' },
      });

      const envelope = errorReporter.report(error);

      expect(envelope.message).toBe('Framework error');
      expect(envelope.code).toBe(ErrorCode.DATABASE_CONNECTION_FAILED);
      expect(envelope.severity).toBe(ErrorSeverity.CRITICAL);
      expect(envelope.context).toEqual({ connectionPool: 'main' });
    });

    it('should include request ID from context', () => {
      runWithContext({ requestId: 'test-req-123' }, () => {
        const envelope = errorReporter.report(new Error('Test error'));

        expect(envelope.requestId).toBe('test-req-123');
      });
    });

    it('should merge options context with error context', () => {
      const error = new FrameworkError('Test error', {
        context: { errorProp: 'value1' },
      });

      const envelope = errorReporter.report(error, {
        context: { optionProp: 'value2' },
      });

      expect(envelope.context).toEqual({
        errorProp: 'value1',
        optionProp: 'value2',
      });
    });

    it('should allow overriding error code via options', () => {
      const error = new Error('Test error');
      const envelope = errorReporter.report(error, {
        code: ErrorCode.VALIDATION_FAILED,
      });

      expect(envelope.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('should allow overriding error severity via options', () => {
      const error = new Error('Test error');
      const envelope = errorReporter.report(error, {
        severity: ErrorSeverity.CRITICAL,
      });

      expect(envelope.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should handle unknown error types', () => {
      const weirdError = { weird: 'object', toString: () => 'WeirdError' };
      const envelope = errorReporter.report(weirdError);

      expect(envelope.message).toBe('WeirdError');
      expect(envelope.code).toBe(ErrorCode.UNKNOWN);
    });

    it('should handle null errors', () => {
      const envelope = errorReporter.report(null);

      expect(envelope.message).toBe('null');
      expect(envelope.code).toBe(ErrorCode.UNKNOWN);
    });

    it('should handle undefined errors', () => {
      const envelope = errorReporter.report(undefined);

      expect(envelope.message).toBe('undefined');
      expect(envelope.code).toBe(ErrorCode.UNKNOWN);
    });

    it('should preserve error stack trace', () => {
      const error = new Error('Test error');
      const envelope = errorReporter.report(error);

      expect(envelope.stack).toBeDefined();
      expect(envelope.stack).toContain('Test error');
    });

    it('should preserve error cause', () => {
      const cause = new Error('Root cause');
      const error = new FrameworkError('Wrapper error', { cause });
      const envelope = errorReporter.report(error);

      expect(envelope.cause).toBe(cause);
    });
  });

  describe('error severity mapping', () => {
    it('should default to ERROR severity for standard errors', () => {
      const envelope = errorReporter.report(new Error('Test'));
      expect(envelope.severity).toBe(ErrorSeverity.ERROR);
    });

    it('should respect severity from FrameworkError', () => {
      const error = new FrameworkError('Fatal error', {
        severity: ErrorSeverity.FATAL,
      });
      const envelope = errorReporter.report(error);

      expect(envelope.severity).toBe(ErrorSeverity.FATAL);
    });

    it('should allow severity override via options', () => {
      const error = new FrameworkError('Error', {
        severity: ErrorSeverity.WARNING,
      });
      const envelope = errorReporter.report(error, {
        severity: ErrorSeverity.CRITICAL,
      });

      expect(envelope.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('context propagation', () => {
    it('should propagate request context automatically', () => {
      runWithContext(
        {
          requestId: 'req-456',
          userId: 'user-789',
        },
        () => {
          const envelope = errorReporter.report(new Error('Test'));

          expect(envelope.requestId).toBe('req-456');
        },
      );
    });

    it('should include custom context from options', () => {
      const envelope = errorReporter.report(new Error('Test'), {
        context: {
          userId: '123',
          action: 'fetchData',
        },
      });

      expect(envelope.context).toEqual({
        userId: '123',
        action: 'fetchData',
      });
    });
  });

  describe('safeSerializeError', () => {
    it('should return "null" for null', () => {
      expect(safeSerializeError(null)).toBe('null');
    });

    it('should return "undefined" for undefined', () => {
      expect(safeSerializeError(undefined)).toBe('undefined');
    });

    it('should extract message from Error instances', () => {
      const error = new Error('Test error message');
      expect(safeSerializeError(error)).toBe('Test error message');
    });

    it('should extract message from objects with message property', () => {
      const obj = { message: 'Custom error message', code: 500 };
      expect(safeSerializeError(obj)).toBe('Custom error message');
    });

    it('should use toString() if available and not [object Object]', () => {
      const obj = { toString: () => 'CustomError: Something went wrong' };
      expect(safeSerializeError(obj)).toBe('CustomError: Something went wrong');
    });

    it('should handle circular references gracefully', () => {
      // Create an object with circular reference (like MikroORM errors)
      const circular: any = { name: 'CircularError' };
      circular.self = circular;
      circular.nested = { parent: circular };

      const result = safeSerializeError(circular);
      expect(result).toBe('[object Object] (circular reference detected)');
    });

    it('should handle complex MikroORM-like error structure', () => {
      // Simulate MikroORM error with entity metadata circular references
      const entity: any = { id: 1, name: 'User' };
      const metadata: any = { entity, className: 'User' };
      entity.__meta = metadata;
      metadata.properties = { user: { entity } };

      const mikroOrmLikeError = {
        message: 'Entity discovery failed',
        metadata,
        entity,
      };

      const result = safeSerializeError(mikroOrmLikeError);
      // Should extract message since it's a string property
      expect(result).toBe('Entity discovery failed');
    });

    it('should handle objects with broken toString()', () => {
      const obj = {
        toString: () => {
          throw new Error('toString failed');
        },
      };

      const result = safeSerializeError(obj);
      // Should fall back to JSON.stringify, which will succeed and exclude the toString function
      expect(result).toBe('{}');
    });

    it('should serialize simple objects without circular references', () => {
      const obj = { error: 'Something failed', code: 500 };
      expect(safeSerializeError(obj)).toBe('{"error":"Something failed","code":500}');
    });

    it('should convert primitives to strings', () => {
      expect(safeSerializeError(42)).toBe('42');
      expect(safeSerializeError(true)).toBe('true');
      expect(safeSerializeError('simple string')).toBe('simple string');
    });

    it('should handle errors with message and circular refs', () => {
      const errorObj: any = {
        message: 'Database connection failed',
        metadata: {},
      };
      errorObj.metadata.error = errorObj;

      const result = safeSerializeError(errorObj);
      // Should extract the message property
      expect(result).toBe('Database connection failed');
    });
  });
});
