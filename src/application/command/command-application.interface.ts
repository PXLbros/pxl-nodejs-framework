import { ApplicationConfig, StartApplicationProps } from '../application.interface';

export interface CommandApplicationConfig extends ApplicationConfig {
  directory: string;
}

export interface StartCommandApplicationProps extends StartApplicationProps {
}
