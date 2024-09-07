export interface AwsS3LocalstackOptions {
  enabled?: boolean;
  port?: number;
}

export interface AwsS3ConstructorOptions {
  region: string;
  localstack: AwsS3LocalstackOptions;
}
