import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  GetObjectCommand,
  UploadPartCommand,
  PutObjectCommand,
  PutObjectCommandInput,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Helper } from '../../util/index.js';
import { AwsS3ConstructorOptions } from './s3.interface.js';
import { createWriteStream } from 'fs';
import { existsSync } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { Readable } from 'stream';
import { Logger } from '../../logger/index.js';

const asyncPipeline = promisify(pipeline);

interface DownloadFileOptions {
  bucketName: string;
  key: string;
  destinationFilePath: string;
}

export default class AwsS3 {
  private client: S3Client;

  private options: AwsS3ConstructorOptions;

  constructor(options: Partial<AwsS3ConstructorOptions>) {
    // Define default options
    const defaultOptions: Partial<AwsS3ConstructorOptions> =
      {
        region: 'us-east-1',
        localstack: {
          enabled: false,
          port: 4566,
        },
      };

    this.options = Helper.defaultsDeep(
      options,
      defaultOptions,
    );

    const s3ClientConfig: S3ClientConfig = {
      region: this.options.region,
    };

    if (this.options.localstack.enabled) {
      s3ClientConfig.forcePathStyle = true;

      if (!this.options.endpoint) {
        throw new Error(
          'Endpoint is required when using LocalStack',
        );
      }

      // s3ClientConfig.endpoint = `http://s3.localhost.localstack.cloud:${this.options.localstack.port}`; // Works when the Node.js API is calling from within the Docker container
      // s3ClientConfig.endpoint = `http://localhost:${this.options.localstack.port}`; // works out side of the container (media generator example)

      s3ClientConfig.endpoint = this.options.endpoint;

      s3ClientConfig.credentials = {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      };
    } else {
      if (
        this.options.credentials?.accessKeyId &&
        this.options.credentials?.secretAccessKey
      ) {
        s3ClientConfig.credentials = {
          accessKeyId: this.options.credentials.accessKeyId,
          secretAccessKey:
            this.options.credentials.secretAccessKey,
        };
      }
    }

    this.client = new S3Client(s3ClientConfig);
  }

  private getBucketUrl({
    bucketName,
    path,
  }: {
    bucketName: string;
    path: string;
  }) {
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
    publicRead,
  }: {
    bucketName: string;
    path: string;
    body: Buffer;
    contentType?: string;
    forceDownload?: boolean;
    publicRead?: boolean;
  }): Promise<string> {
    let contentDisposition = forceDownload
      ? 'attachment'
      : 'inline';
    contentDisposition += `; filename="${path.split('/').pop()}"`;

    const putObjectOptions: PutObjectCommandInput = {
      Bucket: bucketName,
      Key: path,
      Body: body,
      ContentDisposition: contentDisposition,
      ACL: publicRead ? 'public-read' : 'private',
    };

    if (contentType) {
      putObjectOptions.ContentType = contentType;
    }

    const command = new PutObjectCommand(putObjectOptions);

    await this.client.send(command);

    return this.getBucketUrl({ bucketName, path });
  }

  public async startMultipartUpload({
    bucketName,
    path,
    publicRead,
  }: {
    bucketName: string;
    path: string;
    publicRead?: boolean;
  }) {
    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: path,
      ACL: publicRead ? 'public-read' : 'private',
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

  async downloadFile({
    bucketName,
    key,
    destinationFilePath,
  }: DownloadFileOptions): Promise<void> {
    const decodedKey = decodeURIComponent(key);
    const bucketKey = decodedKey;

    // console.log(`Downloading file from S3 (Bucket: ${process.env.S3_BUCKET} | Key: ${bucketKey} | Destination: ${destinationFilePath})...`);
    Logger.info('Downloading file from S3', {
      bucketName,
      Key: bucketKey,
    });

    const getObjectParams = {
      Bucket: bucketName,
      Key: bucketKey,
    };

    try {
      const command = new GetObjectCommand(getObjectParams);

      const { Body } = await this.client.send(command);

      if (!(Body instanceof Readable)) {
        throw new Error('Expected Body to be a stream!');
      }

      const fileStream = createWriteStream(
        destinationFilePath,
      );

      await asyncPipeline(Body, fileStream);

      if (!existsSync(destinationFilePath)) {
        throw new Error(
          `Could not find downloaded file at ${destinationFilePath}`,
        );
      }

      Logger.info('File successfully downloaded', {
        Path: destinationFilePath,
      });
    } catch (error) {
      Logger.error(error);

      throw error;
    }
  }

  public async generateSignedUrl({
    bucket,
    key,
  }: {
    bucket: string;
    key: string;
  }): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      // Set the expiration for the signed URL to 1 hour
      const signedUrl = await getSignedUrl(
        this.client,
        command,
        { expiresIn: 3600 },
      );

      // Log the signed URL
      Logger.info('Generated signed URL', {
        URL: signedUrl,
      });

      return signedUrl;
    } catch (error) {
      Logger.error(error);

      throw error;
    }
  }
}
