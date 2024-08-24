import { existsSync } from 'fs';
import DatabaseInstance from '../database/instance.js';
import { Logger } from '../logger/index.js';
import QueueManager from '../queue/manager.js';
import RedisInstance from '../redis/instance.js';
import BaseApplication from './base-application.js';
import { CommandApplicationConfig } from './command-application.interface.js';
import { Helper, Loader, Time } from '../util/index.js';

export default class CommandApplication extends BaseApplication {
  /** Command application config */
  protected config: CommandApplicationConfig;

  constructor(config: CommandApplicationConfig) {
    super(config);

    const defaultConfig: Partial<CommandApplicationConfig> = {
      cluster: {
        enabled: false,
      },

      log: {
        startUp: false,
      },

      debug: {
        measureExecutionTime: false,
      },
    };

    const mergedConfig: CommandApplicationConfig = Helper.defaultsDeep(config, defaultConfig);

    if (mergedConfig.cluster) {
      mergedConfig.cluster.enabled = false;
    }

    this.config = mergedConfig;
  }

  protected async startHandler({ redisInstance, databaseInstance, queueManager }: { redisInstance: RedisInstance; databaseInstance: DatabaseInstance; queueManager: QueueManager; }): Promise<void> {
    const startTime = performance.now();

    // get argv (yargs) input args
    const argv = this.config.commandManager.argv;

    const parsedArgv = argv.parseSync();

    if (parsedArgv._.length === 0) {
      Logger.warn('No command provided');

      this.stopCommand();

      return;
    }

    const inputCommandName = parsedArgv._[0];

    const commandsDirectoryExists = await existsSync(this.config.commandsDirectory);

    if (!commandsDirectoryExists) {
      Logger.warn('Commands directory not found', { Directory: this.config.commandsDirectory });

      return;
    }

    // Load commands
    const commands = await Loader.loadModulesInDirectory({
      directory: this.config.commandsDirectory,
      extensions: ['.ts', '.js'],
    });

    // Find command by name
    const CommandClass = commands[inputCommandName];

    if (!CommandClass) {
      Logger.warn('Command not found', { Command: inputCommandName });

      return;
    }

    // Initialize command
    const command = new CommandClass({
      applicationConfig: this.config,
      redisInstance: redisInstance,
      queueManager: queueManager,
      databaseInstance: databaseInstance,
    });

    Logger.info('Command started', { Command: inputCommandName });

    // Run command
    await command.run(parsedArgv);

    const commandCompletedLogParams: Record<string, unknown> = {
      Command: inputCommandName,
    };

    if (this.config.debug?.measureExecutionTime) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      commandCompletedLogParams['Execution Time'] = Time.formatTime({ time: executionTime, numDecimals: 2, showUnit: true });
    }

    Logger.info('Command completed', commandCompletedLogParams);

    // Call shutdown signtal to stop the command
    this.stopCommand();
  }

  private stopCommand(): void {
    process.kill(process.pid, 'SIGINT');
  }

  protected stopCallback(): void {
    Logger.info('Command stopped');
  }
}
