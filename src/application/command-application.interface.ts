import { ApplicationConfig } from './base-application.interface.js';

export interface CommandApplicationConfig extends ApplicationConfig {
  commandsDirectory: string;
}
