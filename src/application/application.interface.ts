export interface ApplicationRedisConfig {
  host: string;
  port: number;
  password: string;
}

export interface ApplicationConfig {
  redis: ApplicationRedisConfig;
}

export interface StartApplicationProps {
  onStarted?: ({ startupTime }: { startupTime: [number, number] }) => void;
  onStopped?: ({ runtime }: { runtime: [number, number] }) => void;
}
