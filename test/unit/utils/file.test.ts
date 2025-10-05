import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { pipeline } from 'stream';
import { promisify } from 'node:util';
import File from '../../../src/util/file.js';

// Mock all dependencies
vi.mock('fs');
vi.mock('fs/promises');
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
    it('should return true when path exists', async () => {
      const fsPromises = await import('fs/promises');
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);

      const result = await File.pathExists('/existing/path');

      expect(result).toBe(true);
      expect(fsPromises.access).toHaveBeenCalledWith('/existing/path');
    });

    it('should return false when path does not exist', async () => {
      const fsPromises = await import('fs/promises');
      vi.mocked(fsPromises.access).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await File.pathExists('/non/existent/path');

      expect(result).toBe(false);
      expect(fsPromises.access).toHaveBeenCalledWith('/non/existent/path');
    });
  });

  describe('ensureDir', () => {
    it('should not create directory if it already exists', async () => {
      const fsPromises = await import('fs/promises');
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);

      await File.ensureDir('/existing/dir');

      expect(fsPromises.access).toHaveBeenCalledWith('/existing/dir');
      expect(fsPromises.mkdir).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      const fsPromises = await import('fs/promises');
      vi.mocked(fsPromises.access).mockRejectedValue(new Error('ENOENT'));
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);

      await File.ensureDir('/new/dir');

      expect(fsPromises.access).toHaveBeenCalledWith('/new/dir');
      expect(fsPromises.mkdir).toHaveBeenCalledWith('/new/dir', { recursive: true });
    });
  });

  describe('downloadFile', () => {
    it('should be a function', () => {
      expect(typeof File.downloadFile).toBe('function');
    });

    it('should handle download errors', async () => {
      const mockWriteStream = {
        on: vi.fn().mockReturnThis(),
      };
      const mockResponse = {
        statusCode: 404,
        on: vi.fn(),
      };

      mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
      mockFs.unlink.mockImplementation((path, callback: any) => callback());
      mockHttps.get.mockImplementation((url, callback: any) => {
        callback(mockResponse);
        return { on: vi.fn() } as any;
      });

      await expect(
        File.downloadFile({ url: 'https://example.com/missing.txt', destinationPath: '/tmp/missing.txt' }),
      ).rejects.toThrow();
    });

    it('should handle request errors', async () => {
      const mockWriteStream = {
        on: vi.fn().mockReturnThis(),
      };

      mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
      mockFs.unlink.mockImplementation((path, callback: any) => callback());
      mockHttps.get.mockImplementation(() => {
        return {
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              handler(new Error('Network error'));
            }
            return this;
          }),
        } as any;
      });

      await expect(
        File.downloadFile({ url: 'https://example.com/file.txt', destinationPath: '/tmp/file.txt' }),
      ).rejects.toThrow();
    });

    it('should handle file stream errors', async () => {
      const mockWriteStream = {
        on: vi.fn((event: string, handler: any) => {
          if (event === 'error') {
            handler(new Error('Write error'));
          }
          return mockWriteStream;
        }),
      };

      mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
      mockFs.unlink.mockImplementation((path, callback: any) => callback());

      await expect(
        File.downloadFile({ url: 'https://example.com/file.txt', destinationPath: '/tmp/file.txt' }),
      ).rejects.toThrow();
    });
  });

  describe('convertFile', () => {
    it('should convert file successfully', async () => {
      const ffmpeg = (await import('fluent-ffmpeg')).default;
      const mockFfmpeg = vi.mocked(ffmpeg);

      const mockCommand = {
        output: vi.fn().mockReturnThis(),
        outputFormat: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        run: vi.fn(),
      };

      mockFfmpeg.mockReturnValue(mockCommand as any);

      // Trigger the 'end' event
      mockCommand.on.mockImplementation((event: string, handler: any) => {
        if (event === 'end') {
          setTimeout(() => handler(), 0);
        }
        return mockCommand;
      });

      const promise = File.convertFile({
        inputFilePath: '/input.mp4',
        outputFilePath: '/output.jpg',
        format: 'jpg',
      });

      await promise;

      expect(mockFfmpeg).toHaveBeenCalledWith('/input.mp4');
      expect(mockCommand.output).toHaveBeenCalledWith('/output.jpg');
      expect(mockCommand.outputFormat).toHaveBeenCalledWith('mjpeg');
    });

    it('should handle conversion errors', async () => {
      const ffmpeg = (await import('fluent-ffmpeg')).default;
      const mockFfmpeg = vi.mocked(ffmpeg);

      const mockCommand = {
        output: vi.fn().mockReturnThis(),
        outputFormat: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        run: vi.fn(),
      };

      mockFfmpeg.mockReturnValue(mockCommand as any);

      // Trigger the 'error' event
      mockCommand.on.mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('Conversion failed')), 0);
        }
        return mockCommand;
      });

      await expect(
        File.convertFile({
          inputFilePath: '/input.mp4',
          outputFilePath: '/output.jpg',
          format: 'jpg',
        }),
      ).rejects.toThrow('Conversion failed');
    });

    it('should use correct format for jpg', async () => {
      const ffmpeg = (await import('fluent-ffmpeg')).default;
      const mockFfmpeg = vi.mocked(ffmpeg);

      const mockCommand = {
        output: vi.fn().mockReturnThis(),
        outputFormat: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        run: vi.fn(),
      };

      mockFfmpeg.mockReturnValue(mockCommand as any);

      mockCommand.on.mockImplementation((event: string, handler: any) => {
        if (event === 'end') {
          setTimeout(() => handler(), 0);
        }
        return mockCommand;
      });

      await File.convertFile({
        inputFilePath: '/input.mp4',
        outputFilePath: '/output.jpg',
        format: 'jpg',
      });

      expect(mockCommand.outputFormat).toHaveBeenCalledWith('mjpeg');
    });

    it('should use format as-is for non-jpg formats', async () => {
      const ffmpeg = (await import('fluent-ffmpeg')).default;
      const mockFfmpeg = vi.mocked(ffmpeg);

      const mockCommand = {
        output: vi.fn().mockReturnThis(),
        outputFormat: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        run: vi.fn(),
      };

      mockFfmpeg.mockReturnValue(mockCommand as any);

      mockCommand.on.mockImplementation((event: string, handler: any) => {
        if (event === 'end') {
          setTimeout(() => handler(), 0);
        }
        return mockCommand;
      });

      await File.convertFile({
        inputFilePath: '/input.mp4',
        outputFilePath: '/output.mp4',
        format: 'mp4',
      });

      expect(mockCommand.outputFormat).toHaveBeenCalledWith('mp4');
    });

    it('should handle progress events', async () => {
      const ffmpeg = (await import('fluent-ffmpeg')).default;
      const mockFfmpeg = vi.mocked(ffmpeg);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockCommand = {
        output: vi.fn().mockReturnThis(),
        outputFormat: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        run: vi.fn(),
      };

      mockFfmpeg.mockReturnValue(mockCommand as any);

      mockCommand.on.mockImplementation((event: string, handler: any) => {
        if (event === 'progress') {
          setTimeout(() => handler({ percent: 50 }), 0);
        } else if (event === 'end') {
          setTimeout(() => handler(), 10);
        }
        return mockCommand;
      });

      await File.convertFile({
        inputFilePath: '/input.mp4',
        outputFilePath: '/output.jpg',
        format: 'jpg',
      });

      consoleLogSpy.mockRestore();
    });
  });

  describe('formatFileSize edge cases', () => {
    it('should handle very large numbers', () => {
      const veryLarge = 1024 * 1024 * 1024 * 1024 * 10; // 10 TB
      const result = File.formatFileSize({ bytes: veryLarge });
      expect(result).toContain('TB');
    });

    it('should handle negative numbers gracefully', () => {
      const result = File.formatFileSize({ bytes: -100 });
      // Should handle negative by treating as smallest unit
      expect(result).toBeDefined();
    });

    it('should handle decimal bytes', () => {
      const result = File.formatFileSize({ bytes: 1500.5 });
      expect(result).toBeDefined();
      expect(result).toContain('kB');
    });
  });

  describe('copySync edge cases', () => {
    it('should handle deeply nested directories', () => {
      const mockDirStats = { isDirectory: () => true };
      const mockFileStats = { isDirectory: () => false };

      mockFs.statSync
        .mockReturnValueOnce(mockDirStats as any) // /src
        .mockReturnValueOnce(mockDirStats as any) // /src/level1
        .mockReturnValueOnce(mockFileStats as any); // /src/level1/file.txt

      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.readdirSync
        .mockReturnValueOnce(['level1'] as any) // /src
        .mockReturnValueOnce(['file.txt'] as any) // /src/level1
        .mockReturnValueOnce([] as any); // /src/level1/file.txt (treated as dir in recursive call)

      mockFs.copyFileSync.mockImplementation(() => {});
      mockPath.join.mockImplementation((...segments) => segments.join('/'));

      File.copySync('/src', '/dest');

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe('removeSync edge cases', () => {
    it('should handle empty directories', () => {
      const mockStats = { isDirectory: () => true };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue(mockStats as any);
      mockFs.readdirSync.mockReturnValue([]);
      mockFs.rmdirSync.mockImplementation(() => {});

      File.removeSync('/empty/dir');

      expect(mockFs.readdirSync).toHaveBeenCalledWith('/empty/dir');
      expect(mockFs.rmdirSync).toHaveBeenCalledWith('/empty/dir');
    });

    it('should handle deeply nested directories', () => {
      const mockDirStats = { isDirectory: () => true };
      const mockFileStats = { isDirectory: () => false };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync
        .mockReturnValueOnce(mockDirStats as any) // /root
        .mockReturnValueOnce(mockDirStats as any) // /root/sub
        .mockReturnValueOnce(mockFileStats as any); // /root/sub/file.txt

      mockFs.readdirSync
        .mockReturnValueOnce(['sub'] as any) // /root
        .mockReturnValueOnce(['file.txt'] as any); // /root/sub

      mockFs.unlinkSync.mockImplementation(() => {});
      mockFs.rmdirSync.mockImplementation(() => {});
      mockPath.join.mockImplementation((...segments) => segments.join('/'));

      File.removeSync('/root');

      expect(mockFs.unlinkSync).toHaveBeenCalled();
      expect(mockFs.rmdirSync).toHaveBeenCalledTimes(2); // /root/sub and /root
    });
  });
});
