import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { pipeline } from 'stream';
import { promisify } from 'node:util';
import File from '../../../src/util/file.js';

// Mock all dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('https');
vi.mock('stream');
vi.mock('node:util');
vi.mock('fluent-ffmpeg');

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockHttps = vi.mocked(https);
const mockPipeline = vi.mocked(pipeline);
const mockPromisify = vi.mocked(promisify);

describe('File', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(File.formatFileSize({ bytes: 0 })).toBe('0 bytes');
      expect(File.formatFileSize({ bytes: 500 })).toBe('500.0 bytes');
      expect(File.formatFileSize({ bytes: 1023 })).toBe('1023.0 bytes');
    });

    it('should format kilobytes correctly', () => {
      expect(File.formatFileSize({ bytes: 1024 })).toBe('1.0 kB');
      expect(File.formatFileSize({ bytes: 1536 })).toBe('1.5 kB');
      expect(File.formatFileSize({ bytes: 1024 * 1023 })).toBe('1023.0 kB');
    });

    it('should format megabytes correctly', () => {
      expect(File.formatFileSize({ bytes: 1024 * 1024 })).toBe('1.0 MB');
      expect(File.formatFileSize({ bytes: 1024 * 1024 * 2.5 })).toBe('2.5 MB');
    });

    it('should format gigabytes correctly', () => {
      expect(File.formatFileSize({ bytes: 1024 * 1024 * 1024 })).toBe('1.0 GB');
      expect(File.formatFileSize({ bytes: 1024 * 1024 * 1024 * 1.5 })).toBe('1.5 GB');
    });

    it('should format terabytes correctly', () => {
      expect(File.formatFileSize({ bytes: 1024 * 1024 * 1024 * 1024 })).toBe('1.0 TB');
    });
  });

  describe('copySync', () => {
    it('should copy a file', () => {
      const mockStats = { isDirectory: () => false };
      mockFs.statSync.mockReturnValue(mockStats as any);
      mockFs.copyFileSync.mockImplementation(() => {});

      File.copySync('/src/file.txt', '/dest/file.txt');

      expect(mockFs.statSync).toHaveBeenCalledWith('/src/file.txt');
      expect(mockFs.copyFileSync).toHaveBeenCalledWith('/src/file.txt', '/dest/file.txt');
    });

    it('should copy a directory recursively', () => {
      const mockStats = { isDirectory: () => true };
      mockFs.statSync.mockReturnValue(mockStats as any);
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.readdirSync.mockReturnValue(['file1.txt', 'subdir'] as any);
      mockPath.join.mockImplementation((...segments) => segments.join('/'));

      // Mock recursive calls
      const fileStats = { isDirectory: () => false };
      const dirStats = { isDirectory: () => true };
      mockFs.statSync
        .mockReturnValueOnce(mockStats as any) // Initial call
        .mockReturnValueOnce(fileStats as any) // file1.txt
        .mockReturnValueOnce(dirStats as any); // subdir

      mockFs.readdirSync.mockReturnValueOnce(['file1.txt', 'subdir'] as any).mockReturnValueOnce([] as any); // Empty subdir

      File.copySync('/src', '/dest');

      expect(mockFs.existsSync).toHaveBeenCalledWith('/dest');
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/dest');
      expect(mockFs.readdirSync).toHaveBeenCalledWith('/src');
    });

    it('should not create directory if it already exists', () => {
      const mockStats = { isDirectory: () => true };
      mockFs.statSync.mockReturnValue(mockStats as any);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);

      File.copySync('/src', '/dest');

      expect(mockFs.existsSync).toHaveBeenCalledWith('/dest');
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('removeSync', () => {
    it('should remove a file', () => {
      const mockStats = { isDirectory: () => false };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as any);
      mockFs.unlinkSync.mockImplementation(() => {});

      File.removeSync('/path/to/file.txt');

      expect(mockFs.existsSync).toHaveBeenCalledWith('/path/to/file.txt');
      expect(mockFs.statSync).toHaveBeenCalledWith('/path/to/file.txt');
      expect(mockFs.unlinkSync).toHaveBeenCalledWith('/path/to/file.txt');
    });

    it('should remove a directory recursively', () => {
      const mockStats = { isDirectory: () => true };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as any);
      mockFs.readdirSync.mockReturnValue(['file1.txt']);
      mockFs.rmdirSync.mockImplementation(() => {});
      mockPath.join.mockImplementation((...segments) => segments.join('/'));

      // Mock recursive call for file
      const fileStats = { isDirectory: () => false };
      mockFs.statSync
        .mockReturnValueOnce(mockStats as any) // Initial call
        .mockReturnValueOnce(fileStats as any); // file1.txt

      File.removeSync('/path/to/dir');

      expect(mockFs.readdirSync).toHaveBeenCalledWith('/path/to/dir');
      expect(mockFs.rmdirSync).toHaveBeenCalledWith('/path/to/dir');
    });

    it('should handle non-existent paths gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      File.removeSync('/non/existent/path');

      expect(mockFs.existsSync).toHaveBeenCalledWith('/non/existent/path');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Path /non/existent/path does not exist.');
      expect(mockFs.statSync).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('pathExists', () => {
    it('should be a function', () => {
      expect(typeof File.pathExists).toBe('function');
    });
  });

  describe('ensureDir', () => {
    it('should be a function', () => {
      expect(typeof File.ensureDir).toBe('function');
    });
  });

  describe('downloadFile', () => {
    it('should be a function', () => {
      expect(typeof File.downloadFile).toBe('function');
    });
  });

  describe('convertFile', () => {
    it('should be a function', () => {
      expect(typeof File.convertFile).toBe('function');
    });
  });
});
