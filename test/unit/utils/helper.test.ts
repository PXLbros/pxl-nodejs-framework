import { describe, it, expect } from 'vitest';
import Helper from '../../../src/util/helper.js';

describe('Helper.defaultsDeep', () => {
  describe('basic object merging', () => {
    it('should merge simple objects', () => {
      const target = { a: 1 };
      const source = { b: 2 };
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
      expect(result).toBe(target); // mutates target
    });

    it('should not override existing values', () => {
      const target = { a: 1, b: 2 };
      const source = { a: 99, c: 3 };
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should merge nested objects', () => {
      const target = { a: { x: 1 } };
      const source = { a: { y: 2 } };
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({ a: { x: 1, y: 2 } });
    });

    it('should merge deeply nested objects', () => {
      const target = { a: { b: { c: { d: 1 } } } };
      const source = { a: { b: { c: { e: 2 }, f: 3 } } };
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({
        a: { b: { c: { d: 1, e: 2 }, f: 3 } },
      });
    });

    it('should handle multiple sources', () => {
      const target = { a: 1 };
      const source1 = { b: 2 };
      const source2 = { c: 3 };
      const result = Helper.defaultsDeep(target, source1, source2);

      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });
  });

  describe('array handling', () => {
    it('should merge arrays by index with target values taking precedence', () => {
      const target = { arr: [1, 2] };
      const source = { arr: [99, 98, 97] };
      const result = Helper.defaultsDeep(target, source);

      // Target values at indices 0-1 win, source fills index 2
      expect(result.arr).toEqual([1, 2, 97]);
    });

    it('should merge nested objects within arrays by index', () => {
      const target = { arr: [{ a: 1 }] };
      const source = { arr: [{ b: 2 }] };
      const result = Helper.defaultsDeep(target, source);

      expect(result.arr).toEqual([{ a: 1, b: 2 }]);
    });

    it('should fill undefined array elements from source', () => {
      const target = { arr: [1, undefined, 3] };
      const source = { arr: [99, 2, 98] };
      const result = Helper.defaultsDeep(target, source);

      // undefined elements get filled from source, others preserved
      expect(result.arr).toEqual([1, 2, 3]);
    });

    it('should merge array into object-like target by numeric keys', () => {
      const target = { arr: { 0: 1 } };
      const source = { arr: [99, 98] };
      const result = Helper.defaultsDeep(target, source);

      // Lodash merges array into object, filling missing numeric keys
      expect(result.arr).toEqual({ 0: 1, 1: 98 });
    });
  });

  describe('prototype pollution protection', () => {
    it('should skip __proto__ key', () => {
      const target = {};
      const source = JSON.parse('{"__proto__": {"polluted": true}}');

      Helper.defaultsDeep(target, source);

      expect(Object.prototype).not.toHaveProperty('polluted');
      expect(target).not.toHaveProperty('polluted');
    });

    it('should skip constructor key', () => {
      const target = {};
      const source = { constructor: { polluted: true } };

      Helper.defaultsDeep(target, source);

      expect(target.constructor).toBe(Object);
    });

    it('should skip prototype key', () => {
      const target = {};
      const source = { prototype: { polluted: true } };

      Helper.defaultsDeep(target, source);

      expect(target).not.toHaveProperty('prototype');
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', () => {
      const target = {};
      const source = {};
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({});
    });

    it('should handle null target by creating new object', () => {
      const target = null;
      const source = { a: 1 };
      const result = Helper.defaultsDeep(target, source);

      // Lodash converts null target to object
      expect(result).toEqual({ a: 1 });
    });

    it('should handle null source', () => {
      const target = { a: 1 };
      const source = null;
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({ a: 1 });
    });

    it('should handle undefined source', () => {
      const target = { a: 1 };
      const source = undefined;
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({ a: 1 });
    });

    it('should handle mixed null/undefined in nested objects', () => {
      const target = { a: { b: 1 } };
      const source = { a: null };
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({ a: { b: 1 } });
    });

    it('should preserve false values', () => {
      const target = { a: false };
      const source = { a: true, b: false };
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({ a: false, b: false });
    });

    it('should preserve zero values', () => {
      const target = { a: 0 };
      const source = { a: 99, b: 0 };
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({ a: 0, b: 0 });
    });

    it('should preserve empty string values', () => {
      const target = { a: '' };
      const source = { a: 'default', b: '' };
      const result = Helper.defaultsDeep(target, source);

      expect(result).toEqual({ a: '', b: '' });
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-01-01');
      const target = { a: date };
      const source = { a: new Date('2024-01-01'), b: 2 };
      const result = Helper.defaultsDeep(target, source);

      expect(result.a).toBe(date);
      expect(result.b).toBe(2);
    });

    it('should handle RegExp objects', () => {
      const regex = /test/;
      const target = { a: regex };
      const source = { a: /default/, b: 2 };
      const result = Helper.defaultsDeep(target, source);

      expect(result.a).toBe(regex);
      expect(result.b).toBe(2);
    });
  });

  describe('real-world usage patterns', () => {
    it('should merge config with defaults (webserver pattern)', () => {
      const userConfig = {
        host: 'localhost',
        cors: {
          enabled: true,
        },
      };

      const defaults = {
        host: '0.0.0.0',
        port: 3001,
        cors: {
          enabled: false,
          urls: [],
        },
        errors: {
          verbose: false,
        },
      };

      const result = Helper.defaultsDeep(userConfig, defaults);

      expect(result).toEqual({
        host: 'localhost', // user value preserved
        port: 3001, // default applied
        cors: {
          enabled: true, // user value preserved
          urls: [], // default applied
        },
        errors: {
          verbose: false, // default applied
        },
      });
    });

    it('should merge queue options with defaults', () => {
      const userOptions = {
        queues: [{ name: 'email' }],
      };

      const defaults = {
        queues: [],
        processorsDirectory: '/default/path',
        log: {
          jobRegistered: false,
        },
      };

      const result = Helper.defaultsDeep(userOptions, defaults);

      expect(result).toEqual({
        queues: [{ name: 'email' }], // user array preserved
        processorsDirectory: '/default/path',
        log: {
          jobRegistered: false,
        },
      });
    });
  });
});

describe('Helper.isObject', () => {
  it('should return true for plain objects', () => {
    expect(Helper.isObject({})).toBe(true);
    expect(Helper.isObject({ a: 1 })).toBe(true);
  });

  it('should return false for arrays', () => {
    expect(Helper.isObject([])).toBe(false);
    expect(Helper.isObject([1, 2])).toBe(false);
  });

  it('should return falsy for null', () => {
    expect(Helper.isObject(null)).toBeFalsy();
  });

  it('should return falsy for undefined', () => {
    expect(Helper.isObject(undefined)).toBeFalsy();
  });

  it('should return false for primitives', () => {
    expect(Helper.isObject(1)).toBe(false);
    expect(Helper.isObject('string')).toBe(false);
    expect(Helper.isObject(true)).toBe(false);
  });

  it('should return true for Date objects', () => {
    expect(Helper.isObject(new Date())).toBe(true);
  });

  it('should return true for RegExp objects', () => {
    expect(Helper.isObject(/test/)).toBe(true);
  });
});

describe('Helper.getValueFromObject', () => {
  it('should retrieve value from simple path', () => {
    const obj = { user: 'John' };
    expect(Helper.getValueFromObject(obj, 'user')).toBe('John');
  });

  it('should retrieve value from nested path', () => {
    const obj = { user: { email: 'john@example.com' } };
    expect(Helper.getValueFromObject(obj, 'user.email')).toBe('john@example.com');
  });

  it('should retrieve value from deeply nested path', () => {
    const obj = { a: { b: { c: { d: 'value' } } } };
    expect(Helper.getValueFromObject(obj, 'a.b.c.d')).toBe('value');
  });

  it('should return undefined for non-existent path', () => {
    const obj = { a: { b: 1 } };
    expect(Helper.getValueFromObject(obj, 'a.c')).toBeUndefined();
  });

  it('should return undefined for __proto__ access', () => {
    const obj = { a: 1 };
    expect(Helper.getValueFromObject(obj, '__proto__')).toBeUndefined();
    expect(Helper.getValueFromObject(obj, 'a.__proto__')).toBeUndefined();
  });

  it('should return undefined for constructor access', () => {
    const obj = { a: 1 };
    expect(Helper.getValueFromObject(obj, 'constructor')).toBeUndefined();
  });

  it('should return undefined for prototype access', () => {
    const obj = { a: 1 };
    expect(Helper.getValueFromObject(obj, 'prototype')).toBeUndefined();
  });

  it('should handle numeric string keys', () => {
    const obj = { '0': 'first', '1': 'second' };
    expect(Helper.getValueFromObject(obj, '0')).toBe('first');
  });
});

describe('Helper.getValueFromArray', () => {
  it('should retrieve values from array of objects', () => {
    const arr = [{ user: { email: 'a@example.com' } }, { user: { email: 'b@example.com' } }];
    const result = Helper.getValueFromArray(arr, 'user.email');

    expect(result).toEqual(['a@example.com', 'b@example.com']);
  });

  it('should handle empty array', () => {
    const arr: any[] = [];
    const result = Helper.getValueFromArray(arr, 'user.email');

    expect(result).toEqual([]);
  });

  it('should return undefined for non-existent paths', () => {
    const arr = [{ a: 1 }, { a: 2 }];
    const result = Helper.getValueFromArray(arr, 'b');

    expect(result).toEqual([undefined, undefined]);
  });
});

describe('Helper.getScriptFileExtension', () => {
  it('should return "ts" in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    expect(Helper.getScriptFileExtension()).toBe('ts');

    process.env.NODE_ENV = originalEnv;
  });

  it('should return "js" in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    expect(Helper.getScriptFileExtension()).toBe('js');

    process.env.NODE_ENV = originalEnv;
  });

  it('should return "js" when NODE_ENV is not set', () => {
    const originalEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    expect(Helper.getScriptFileExtension()).toBe('js');

    process.env.NODE_ENV = originalEnv;
  });
});
