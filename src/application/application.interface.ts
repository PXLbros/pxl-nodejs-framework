export interface ApplicationRedisConfig {
  host: string;
  port: number;
  password: string;
}

export interface ApplicationConfig {
  redis: ApplicationRedisConfig;
}
