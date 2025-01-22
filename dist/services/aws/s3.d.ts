import { S3Client } from '@aws-sdk/client-s3';
import { AwsS3ConstructorOptions } from './s3.interface.js';
interface DownloadFileOptions {
    bucketName: string;
    key: string;
    destinationFilePath: string;
}
export default class AwsS3 {
    client: S3Client;
    private options;
    constructor(options: Partial<AwsS3ConstructorOptions>);
    private getBucketUrl;
    uploadFile({ bucketName, path, body, contentType, forceDownload, publicRead, }: {
        bucketName: string;
        path: string;
        body: Buffer;
        contentType?: string;
        forceDownload?: boolean;
        publicRead?: boolean;
    }): Promise<string>;
    startMultipartUpload({ bucketName, path, publicRead, }: {
        bucketName: string;
        path: string;
        publicRead?: boolean;
    }): Promise<string | undefined>;
    uploadPart({ bucketName, path, partNumber, uploadId, body, }: {
        bucketName: string;
        path: string;
        partNumber: number;
        uploadId: string;
        body: any;
    }): Promise<string | undefined>;
    completeMultipartUpload({ bucketName, path, uploadId, parts, }: {
        bucketName: string;
        path: string;
        uploadId: string;
        parts: {
            PartNumber: number;
            ETag: string;
        }[];
    }): Promise<string | undefined>;
    downloadFile({ bucketName, key, destinationFilePath, onStart, onProgress, onComplete, onError, }: DownloadFileOptions & {
        onStart?: () => void;
        onProgress?: (progress: number) => void;
        onComplete?: () => void;
        onError?: (error: Error) => void;
    }): Promise<void>;
    generateSignedUrl({ bucket, key, }: {
        bucket: string;
        key: string;
    }): Promise<string>;
}
export {};
//# sourceMappingURL=s3.d.ts.map