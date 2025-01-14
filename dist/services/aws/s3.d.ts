import { AwsS3ConstructorOptions } from './s3.interface.js';
interface DownloadFileOptions {
    bucketName: string;
    key: string;
    destinationFilePath: string;
}
export default class AwsS3 {
    private client;
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
    downloadFile({ bucketName, key, destinationFilePath, }: DownloadFileOptions): Promise<void>;
    generateSignedUrl({ bucket, key, }: {
        bucket: string;
        key: string;
    }): Promise<string>;
}
export {};
//# sourceMappingURL=s3.d.ts.map