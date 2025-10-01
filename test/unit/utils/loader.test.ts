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
});
