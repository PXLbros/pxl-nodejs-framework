import ApplicationInstance from '../application/application-instance';

export type ClusterWorkerMode = 'auto' | 'manual';

export interface ClusterManagerDisabledConfig {
  enabled: false;
  workerMode?: ClusterWorkerMode;
  workerCount?: never;
}

export interface ClusterManagerEnabledConfigBase {
  enabled: true;
}

export interface ClusterManagerWorkerModeAutoConfig extends ClusterManagerEnabledConfigBase {
  workerMode: 'auto';
}

export interface ClusterManagerWorkerModeManualConfig extends ClusterManagerEnabledConfigBase {
  workerMode: 'manual';
  workerCount: number;
}

export type ClusterManagerConfig =
  | ClusterManagerDisabledConfig
  | ClusterManagerWorkerModeAutoConfig
  | ClusterManagerWorkerModeManualConfig;

export interface ClusterManagerProps {
  config: ClusterManagerConfig;

  startApplicationCallback: () => Promise<ApplicationInstance>;
  stopApplicationCallback: () => void;
}
