import CommandManager from '../command/command-manager.js';
import { ApplicationConfig } from './base-application.interface.js';

export interface CommandApplicationConfig extends ApplicationConfig {
  /** Commands directory */
  commandsDirectory: string;

  /** Command manager */
  commandManager: CommandManager;

  /** Command debug config */
  debug?: {
    measureExecutionTime?: boolean;
  };
}
