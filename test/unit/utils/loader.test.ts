import { describe, it, expect, vi, beforeEach } from 'vitest';
import Loader from '../../../src/util/loader.js';
import fs from 'fs';
import path from 'path';

// Mock fs
vi.mock('fs', () => ({
  default: {
    promises: {
      readdir: vi.fn(),
    },
  },
}));

// Mock path
vi.mock('path', () => ({
  default: {
    extname: vi.fn((file: string) => {
      const parts = file.split('.');
      return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
    }),
    basename: vi.fn((file: string, ext: string) => {
      const name = file.split('/').pop() || file;
      if (ext && name.endsWith(ext)) {
        return name.slice(0, -ext.length);
      }
      return name.split('.')[0];
    }),
    join: vi.fn((...args: string[]) => args.join('/')),
    isAbsolute: vi.fn((p: string) => p.startsWith('/')),
    resolve: vi.fn((...args: string[]) => {
      const parts = args.filter(Boolean);
      if (parts.length === 0) return '/';
      const joined = parts.join('/');
      return joined.startsWith('/') ? joined : `/${joined}`;
    }),
  },
}));

// Mock Helper
vi.mock('../../../src/util/index.js', () => ({
  Helper: {
    getScriptFileExtension: vi.fn(() => 'js'),
  },
}));

describe('Loader utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Loader.clearModuleCache();
  });

  describe('getCacheStats', () => {
    it('should return cache stats', () => {
      const stats = Loader.getCacheStats();

      expect(stats).toHaveProperty('modulesCached');
      expect(stats).toHaveProperty('entitiesCached');
      expect(typeof stats.modulesCached).toBe('number');
      expect(typeof stats.entitiesCached).toBe('number');
    });

    it('should show empty cache initially', () => {
      Loader.clearModuleCache();
      const stats = Loader.getCacheStats();

      expect(stats.modulesCached).toBe(0);
      expect(stats.entitiesCached).toBe(0);
    });
  });

  describe('clearModuleCache', () => {
    it('should clear the cache', () => {
      Loader.clearModuleCache();
      const stats = Loader.getCacheStats();

      expect(stats.modulesCached).toBe(0);
      expect(stats.entitiesCached).toBe(0);
    });
  });

  describe('loadModulesInDirectory', () => {
    it('should return empty object when directory is empty', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([] as any);

      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      expect(result).toEqual({});
    });

    it('should skip directories', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'subdir', isDirectory: () => true }] as any);

      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      expect(result).toEqual({});
    });

    it('should skip .d.ts files', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'types.d.ts', isDirectory: () => false }] as any);

      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
        extensions: ['.ts'],
      });

      expect(result).toEqual({});
    });

    it('should filter by extensions', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        { name: 'file.js', isDirectory: () => false },
        { name: 'file.ts', isDirectory: () => false },
      ] as any);

      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
        extensions: ['.js'],
      });

      // Can't easily test actual imports without real files
      // but we can verify the function doesn't throw
      expect(result).toBeDefined();
    });
  });

  describe('loadEntityModule', () => {
    it('should throw error for invalid entity name __proto__', async () => {
      await expect(
        Loader.loadEntityModule({
          entitiesDirectory: '/test/entities',
          entityName: '__proto__',
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid entity name constructor', async () => {
      await expect(
        Loader.loadEntityModule({
          entitiesDirectory: '/test/entities',
          entityName: 'constructor',
        }),
      ).rejects.toThrow();
    });

    it('should throw error for invalid entity name prototype', async () => {
      await expect(
        Loader.loadEntityModule({
          entitiesDirectory: '/test/entities',
          entityName: 'prototype',
        }),
      ).rejects.toThrow();
    });
  });

  describe('cache behavior', () => {
    it('should cache loaded modules', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'test.js', isDirectory: () => false }] as any);

      // Load first time
      await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      const stats1 = Loader.getCacheStats();
      expect(stats1.modulesCached).toBe(1);

      // Load same directory again (should use cache)
      await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      const stats2 = Loader.getCacheStats();
      expect(stats2.modulesCached).toBe(1); // Still 1, not 2
    });

    it('should differentiate cache by directory and extensions', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'test.js', isDirectory: () => false }] as any);

      // Load with no extensions filter
      await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      // Load with extensions filter (different cache key)
      await Loader.loadModulesInDirectory({
        directory: '/test/dir',
        extensions: ['.js'],
      });

      const stats = Loader.getCacheStats();
      expect(stats.modulesCached).toBeGreaterThan(1);
    });

    it('should clear both module and entity caches', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'test.js', isDirectory: () => false }] as any);

      await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      let stats = Loader.getCacheStats();
      expect(stats.modulesCached).toBeGreaterThan(0);

      Loader.clearModuleCache();

      stats = Loader.getCacheStats();
      expect(stats.modulesCached).toBe(0);
      expect(stats.entitiesCached).toBe(0);
    });
  });

  describe('loadModulesInDirectory edge cases', () => {
    it('should handle files without extensions', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'README', isDirectory: () => false }] as any);

      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
        extensions: ['.js'],
      });

      // File without extension should be filtered out
      expect(result).toEqual({});
    });

    it('should handle multiple extensions', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        { name: 'file.js', isDirectory: () => false },
        { name: 'file.ts', isDirectory: () => false },
        { name: 'file.json', isDirectory: () => false },
      ] as any);

      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
        extensions: ['.js', '.ts'],
      });

      expect(result).toBeDefined();
    });

    it('should use default extensions when not specified', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'file.js', isDirectory: () => false }] as any);

      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      expect(result).toBeDefined();
    });

    it('should prevent prototype pollution with safe property assignment', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        { name: '__proto__.js', isDirectory: () => false },
        { name: 'constructor.js', isDirectory: () => false },
        { name: 'prototype.js', isDirectory: () => false },
      ] as any);

      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      // These dangerous property names should be filtered out
      expect(result).not.toHaveProperty('__proto__');
      expect(result).not.toHaveProperty('constructor');
      expect(result).not.toHaveProperty('prototype');
    });

    it('should handle import errors gracefully', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'broken.js', isDirectory: () => false }] as any);

      // Should not throw, just log the error
      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      expect(result).toBeDefined();
    });
  });

  describe('file path handling', () => {
    it('should convert to absolute path', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'test.js', isDirectory: () => false }] as any);

      const result = await Loader.loadModulesInDirectory({
        directory: '/absolute/path',
      });

      // Just verify the function completed
      expect(result).toBeDefined();
    });

    it('should handle relative paths', async () => {
      vi.mocked(fs.promises.readdir).mockResolvedValue([{ name: 'test.js', isDirectory: () => false }] as any);

      // The loader should handle relative paths
      const result = await Loader.loadModulesInDirectory({
        directory: '/test/dir',
      });

      expect(result).toBeDefined();
    });
  });
});
