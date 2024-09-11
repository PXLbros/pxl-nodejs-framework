import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  UploadPartCommand,
  PutObjectCommand,
  PutObjectCommandInput,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Helper } from '../../util/index.js';
import { AwsS3ConstructorOptions } from './s3.interface.js';

export default class AwsS3 {
  private client: S3Client;

  private options: AwsS3ConstructorOptions;

  constructor(options: Partial<AwsS3ConstructorOptions>) {
    // Define default options
    const defaultOptions: Partial<AwsS3ConstructorOptions> = {
      region: 'us-east-1',
      localstack: {
        enabled: false,
        port: 4566,
      },
    };

    this.options = Helper.defaultsDeep(options, defaultOptions);

    const s3ClientConfig: S3ClientConfig = {
      region: 'us-east-1',
    };

    if (this.options.localstack.enabled) {
      s3ClientConfig.endpoint = `http://s3.localhost.localstack.cloud:${this.options.localstack.port}`;

      s3ClientConfig.credentials = {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      };
    } else {
      if (this.options.credentials?.accessKeyId && this.options.credentials?.secretAccessKey) {
        s3ClientConfig.credentials = {
          accessKeyId: this.options.credentials.accessKeyId,
          secretAccessKey: this.options.credentials.secretAccessKey,
        };
      }
    }

    this.client = new S3Client(s3ClientConfig);
  }

  private getBucketUrl({ bucketName, path }: { bucketName: string; path: string }) {
    let url;

    if (this.options.localstack.enabled) {
      url = `http://localhost:${this.options.localstack.port}/${bucketName}/${path}`;
    } else {
      url = `https://${bucketName}.s3.amazonaws.com/${path}`;
    }

    return url;
  }

  public async uploadFile({
    bucketName,
    path,
    body,
    contentType,
    forceDownload,
  }: {
    bucketName: string;
    path: string;
    body: Buffer;
    contentType?: string;
    forceDownload?: boolean;
  }): Promise<string> {
    let contentDisposition = forceDownload ? 'attachment' : 'inline';
    contentDisposition += `; filename="${path.split('/').pop()}"`;

    const putObjectOptions: PutObjectCommandInput = {
      Bucket: bucketName,
      Key: path,
      Body: body,
      ContentDisposition: contentDisposition,
    };

    if (contentType) {
      putObjectOptions.ContentType = contentType;
    }

    const command = new PutObjectCommand(putObjectOptions);

    await this.client.send(command);

    return this.getBucketUrl({ bucketName, path });
  }

  public async startMultipartUpload({ bucketName, path }: { bucketName: string; path: string }) {
    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: path,
    });

    const response = await this.client.send(command);

    return response.UploadId;
  }

  public async uploadPart({
    bucketName,
    path,
    partNumber,
    uploadId,
    body,
  }: {
    bucketName: string;
    path: string;
    partNumber: number;
    uploadId: string;
    body: any;
  }): Promise<string | undefined> {
    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: path,
      PartNumber: partNumber,
      UploadId: uploadId,
      Body: body,
    });

    const response = await this.client.send(command);

    return response.ETag;
  }

  public async completeMultipartUpload({
    bucketName,
    path,
    uploadId,
    parts,
  }: {
    bucketName: string;
    path: string;
    uploadId: string;
    parts: { PartNumber: number; ETag: string }[];
  }) {
    // Sort parts by PartNumber
    parts.sort((a, b) => a.PartNumber - b.PartNumber);

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: path,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });

    const response = await this.client.send(command);

    return response.Location;
  }
}
