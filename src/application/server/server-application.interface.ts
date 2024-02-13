import { ApplicationRedisConfig } from '../application.interface';

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
}
