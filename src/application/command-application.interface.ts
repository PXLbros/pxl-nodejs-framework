import type CommandManager from '../command/command-manager.js';
import type { ApplicationConfig } from './base-application.interface.js';
import type CommandApplication from './command-application.js';

export interface CommandApplicationEventsConfig {
  onStarted?: ({ app, startupTime }: { app: CommandApplication; startupTime: number }) => void;
  onStopped?: ({ app, runtime }: { app: CommandApplication; runtime: number }) => void;
}

export interface CommandApplicationConfig extends ApplicationConfig {
  /** Commands directory */
  commandsDirectory: string;

  /** Command manager */
  commandManager: CommandManager;

  /** Command debug config */
  debug?: {
    measureExecutionTime?: boolean;
  };

  /** Command application events */
  events?: CommandApplicationEventsConfig;
}
