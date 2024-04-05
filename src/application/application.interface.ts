import { ClusterManagerConfig } from '../cluster/cluster-manager.interface.js';
import { QueueManagerOptions } from '../queue/manager.interface.js';

export interface ApplicationRedisConfig {
  /** Redis host */
  host: string;

  /** Redis port */
  port: number;

  /** Redis password */
  password?: string;
}

export interface ApplicationDatabaseConfig {
  /** Database host */
  host: string;

  /** Database port */
  port: number;

  /** Database username */
  username: string;

  /** Database password */
  password: string;

  /** Database name */
  databaseName: string;
}

export interface ApplicationWebServerConfig {
  /** Whether to enable web server */
  enabled: boolean;

  /** Web server host */
  host: string;

  /** Web server port */
  port: number;
}

export interface ApplicationConfig {
  /** Application name */
  name: string;

  /** Cluster configuration */
  cluster: ClusterManagerConfig;

  /** Redis configuration */
  redis: ApplicationRedisConfig;

  /** Database configuration */
  database: ApplicationDatabaseConfig;

  /** Web server configuration */
  webServer?: ApplicationWebServerConfig;

  /** Queue configuration */
  queue: QueueManagerOptions;
}
