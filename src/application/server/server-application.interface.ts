import { ApplicationRedisConfig } from '../application.interface';
import { WebServerConfig } from '../../webserver/webserver.interface';

interface ServerApplicationClusterBaseConfig {
  enabled?: boolean;
}

export interface ServerApplicationClusterWorkerModeAutoConfig extends ServerApplicationClusterBaseConfig {
  workerMode?: 'auto';
}

export interface ServerApplicationClusterWorkerModeManualConfig extends ServerApplicationClusterBaseConfig {
  workerMode?: 'manual';
  workerCount: number;
}

export interface ServerApplicationConfig {
  redis: ApplicationRedisConfig;

  cluster?: ServerApplicationClusterWorkerModeAutoConfig | ServerApplicationClusterWorkerModeManualConfig;

  webServer: WebServerConfig;
}
