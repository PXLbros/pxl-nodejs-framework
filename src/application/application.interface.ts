export interface ApplicationRedisConfig {
  host: string;
  port: number;
  password: string;
}

export interface ApplicationConfig {
  redis: ApplicationRedisConfig;
}

export type OnStartedEvent = ({ startupTime }: { startupTime: number }) => void;
export type OnStoppedEvent = ({ runtime }: { runtime: number }) => void;

export interface StartApplicationProps {
  onStarted?: OnStartedEvent;
  onStopped?: OnStoppedEvent;
}
