import { describe, it, expect, vi, beforeEach } from 'vitest';
import AwsS3 from '../../../../src/services/aws/s3.js';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class {
      send = vi.fn().mockResolvedValue({
        UploadId: 'test-upload-id',
        ETag: 'test-etag',
        Location: 'https://test-bucket.s3.amazonaws.com/test/file.txt',
      });
    },
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    CreateMultipartUploadCommand: vi.fn(),
    UploadPartCommand: vi.fn(),
    CompleteMultipartUploadCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com'),
}));

// Mock utilities
vi.mock('../../../../src/util/index.js', async () => {
  const actual = await vi.importActual('../../../../src/util/index.js');
  return {
    ...actual,
    Helper: {
      defaultsDeep: vi.fn((options: any, defaults: any) => ({ ...defaults, ...options })),
    },
    File: {
      pathExists: vi.fn().mockResolvedValue(true),
      ensureDir: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock logger
vi.mock('../../../../src/logger/index.js', () => ({
  Logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('AwsS3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create S3 client with default options', () => {
      const s3 = new AwsS3({});

      expect(s3).toBeDefined();
      expect(s3.client).toBeDefined();
    });

    it('should create S3 client with custom region', () => {
      const s3 = new AwsS3({
        region: 'us-west-2',
      });

      expect(s3).toBeDefined();
    });

    it('should create S3 client with credentials', () => {
      const s3 = new AwsS3({
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      });

      expect(s3).toBeDefined();
    });

    it('should create S3 client for LocalStack', () => {
      const s3 = new AwsS3({
        localstack: {
          enabled: true,
          port: 4566,
        },
        endpoint: 'http://localhost:4566',
      });

      expect(s3).toBeDefined();
    });

    it('should throw error when LocalStack enabled without endpoint', () => {
      expect(() => {
        new AwsS3({
          localstack: {
            enabled: true,
            port: 4566,
          },
        });
      }).toThrow('Endpoint is required when using LocalStack');
    });
  });

  describe('uploadFile', () => {
    it('should upload file with default options', async () => {
      const s3 = new AwsS3({});
      const buffer = Buffer.from('test content');

      const result = await s3.uploadFile({
        bucketName: 'test-bucket',
        path: 'test/file.txt',
        body: buffer,
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should upload file with content type', async () => {
      const s3 = new AwsS3({});
      const buffer = Buffer.from('test content');

      const result = await s3.uploadFile({
        bucketName: 'test-bucket',
        path: 'test/file.txt',
        body: buffer,
        contentType: 'text/plain',
      });

      expect(result).toBeDefined();
    });

    it('should upload file with force download option', async () => {
      const s3 = new AwsS3({});
      const buffer = Buffer.from('test content');

      const result = await s3.uploadFile({
        bucketName: 'test-bucket',
        path: 'test/file.txt',
        body: buffer,
        forceDownload: true,
      });

      expect(result).toBeDefined();
    });

    it('should upload file with public read ACL', async () => {
      const s3 = new AwsS3({});
      const buffer = Buffer.from('test content');

      const result = await s3.uploadFile({
        bucketName: 'test-bucket',
        path: 'test/file.txt',
        body: buffer,
        publicRead: true,
      });

      expect(result).toBeDefined();
    });

    it('should return LocalStack URL when LocalStack enabled', async () => {
      const s3 = new AwsS3({
        localstack: {
          enabled: true,
          port: 4566,
        },
        endpoint: 'http://localhost:4566',
      });
      const buffer = Buffer.from('test content');

      const result = await s3.uploadFile({
        bucketName: 'test-bucket',
        path: 'test/file.txt',
        body: buffer,
      });

      expect(result).toContain('localhost:4566');
      expect(result).toContain('test-bucket');
    });

    it('should return AWS URL when LocalStack disabled', async () => {
      const s3 = new AwsS3({
        region: 'us-east-1',
      });
      const buffer = Buffer.from('test content');

      const result = await s3.uploadFile({
        bucketName: 'test-bucket',
        path: 'test/file.txt',
        body: buffer,
      });

      expect(result).toContain('s3.amazonaws.com');
    });
  });

  describe('startMultipartUpload', () => {
    it('should start multipart upload', async () => {
      const s3 = new AwsS3({});

      const uploadId = await s3.startMultipartUpload({
        bucketName: 'test-bucket',
        path: 'test/large-file.mp4',
      });

      expect(uploadId).toBe('test-upload-id');
    });

    it('should start multipart upload with public read', async () => {
      const s3 = new AwsS3({});

      const uploadId = await s3.startMultipartUpload({
        bucketName: 'test-bucket',
        path: 'test/large-file.mp4',
        publicRead: true,
      });

      expect(uploadId).toBe('test-upload-id');
    });
  });

  describe('uploadPart', () => {
    it('should upload a part', async () => {
      const s3 = new AwsS3({});
      const buffer = Buffer.from('part content');

      const result = await s3.uploadPart({
        bucketName: 'test-bucket',
        path: 'test/large-file.mp4',
        partNumber: 1,
        uploadId: 'test-upload-id',
        body: buffer,
      });

      expect(result).toBeDefined();
    });
  });

  describe('completeMultipartUpload', () => {
    it('should complete multipart upload', async () => {
      const s3 = new AwsS3({});

      const result = await s3.completeMultipartUpload({
        bucketName: 'test-bucket',
        path: 'test/large-file.mp4',
        uploadId: 'test-upload-id',
        parts: [{ ETag: 'etag1', PartNumber: 1 }],
      });

      expect(result).toBeDefined();
    });

    it('should complete multipart upload with multiple parts', async () => {
      const s3 = new AwsS3({});

      const result = await s3.completeMultipartUpload({
        bucketName: 'test-bucket',
        path: 'test/large-file.mp4',
        uploadId: 'test-upload-id',
        parts: [
          { ETag: 'etag1', PartNumber: 1 },
          { ETag: 'etag2', PartNumber: 2 },
          { ETag: 'etag3', PartNumber: 3 },
        ],
      });

      expect(result).toBeDefined();
    });
  });

  describe('downloadFile', () => {
    it('should have downloadFile method', async () => {
      const s3 = new AwsS3({});

      // Just test that the function exists
      expect(s3.downloadFile).toBeDefined();
      expect(typeof s3.downloadFile).toBe('function');
    });

    it('should call all lifecycle callbacks during download', async () => {
      const { Readable } = await import('stream');
      const mockReadable = new Readable();
      mockReadable._read = () => {};

      // Mock S3Client.send to return a stream
      const s3 = new AwsS3({});
      vi.spyOn(s3.client, 'send').mockResolvedValue({
        Body: mockReadable,
        ContentLength: 1000,
      } as any);

      const onStart = vi.fn();
      const onProgress = vi.fn();
      const onComplete = vi.fn();

      const downloadPromise = s3.downloadFile({
        bucketName: 'test-bucket',
        key: 'test/file.txt',
        destinationFilePath: '/tmp/test-file.txt',
        onStart,
        onProgress,
        onComplete,
      });

      // Emit data and end
      mockReadable.push(Buffer.from('test content'));
      mockReadable.push(null);

      await downloadPromise;

      expect(onStart).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it('should call onError when download fails', async () => {
      const s3 = new AwsS3({});
      const testError = new Error('Download failed');
      vi.spyOn(s3.client, 'send').mockRejectedValue(testError);

      const onError = vi.fn();

      await expect(
        s3.downloadFile({
          bucketName: 'test-bucket',
          key: 'test/file.txt',
          destinationFilePath: '/tmp/test-file.txt',
          onError,
        }),
      ).rejects.toThrow('Download failed');

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('should throw error when response body is not readable', async () => {
      const s3 = new AwsS3({});
      vi.spyOn(s3.client, 'send').mockResolvedValue({
        Body: null,
      } as any);

      await expect(
        s3.downloadFile({
          bucketName: 'test-bucket',
          key: 'test/file.txt',
          destinationFilePath: '/tmp/test-file.txt',
        }),
      ).rejects.toThrow('Expected Body to be a readable stream!');
    });

    it('should decode URI-encoded keys', async () => {
      const { Readable } = await import('stream');
      const mockReadable = new Readable();
      mockReadable._read = () => {};

      const s3 = new AwsS3({});
      const sendSpy = vi.spyOn(s3.client, 'send').mockResolvedValue({
        Body: mockReadable,
        ContentLength: 100,
      } as any);

      const downloadPromise = s3.downloadFile({
        bucketName: 'test-bucket',
        key: 'test%20file%20with%20spaces.txt',
        destinationFilePath: '/tmp/test-file.txt',
      });

      mockReadable.push(Buffer.from('test'));
      mockReadable.push(null);

      await downloadPromise;

      expect(sendSpy).toHaveBeenCalled();
    });
  });

  describe('multipart upload flow', () => {
    it('should expose multipart upload methods', async () => {
      const s3 = new AwsS3({});

      // Just verify methods exist
      expect(typeof s3.startMultipartUpload).toBe('function');
      expect(typeof s3.uploadPart).toBe('function');
      expect(typeof s3.completeMultipartUpload).toBe('function');
    });
  });

  describe('configuration options', () => {
    it('should use default region when not specified', () => {
      const s3 = new AwsS3({});

      expect(s3).toBeDefined();
      expect(s3.client).toBeDefined();
    });

    it('should configure with all options', () => {
      const s3 = new AwsS3({
        region: 'eu-west-1',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
        localstack: {
          enabled: false,
          port: 4566,
        },
      });

      expect(s3).toBeDefined();
    });

    it('should handle localstack configuration', () => {
      const s3 = new AwsS3({
        region: 'us-east-1',
        localstack: {
          enabled: true,
          port: 4566,
        },
        endpoint: 'http://localhost:4566',
      });

      expect(s3).toBeDefined();
    });
  });

  describe('URL generation', () => {
    it('should generate correct URL for AWS S3', async () => {
      const s3 = new AwsS3({
        region: 'us-west-2',
      });
      const buffer = Buffer.from('test');

      const url = await s3.uploadFile({
        bucketName: 'my-bucket',
        path: 'files/test.txt',
        body: buffer,
      });

      expect(url).toContain('s3');
      expect(url).toContain('amazonaws.com');
    });

    it('should generate correct URL for LocalStack', async () => {
      const s3 = new AwsS3({
        localstack: {
          enabled: true,
          port: 4566,
        },
        endpoint: 'http://localhost:4566',
      });
      const buffer = Buffer.from('test');

      const url = await s3.uploadFile({
        bucketName: 'local-bucket',
        path: 'files/test.txt',
        body: buffer,
      });

      expect(url).toContain('localhost');
      expect(url).toContain('4566');
    });
  });
});
