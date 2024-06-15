export interface AwsS3LocalstackOptions {
  port: number;
}

export interface AwsS3ConstructorOptions {
  localstack: AwsS3LocalstackOptions;
}
