import type { ApplicationConfig } from '../application/base-application.interface.js';

export interface RedisManagerConfig {
  applicationConfig: ApplicationConfig;
  host: string;
  port: number;
  password?: string;
}
