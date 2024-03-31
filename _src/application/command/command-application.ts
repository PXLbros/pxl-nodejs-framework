import path from 'path';
import { Command } from 'commander';
import Application from '../application';
import { CommandApplicationConfig, StartCommandApplicationProps } from './command-application.interface';
import logger from '../../logger/logger';
import RedisInstance from '../../redis/redis-instance';
import { loadModulesInDirectory } from '../../util/loader';
import { CommandType } from './command.interface';

export default class CommandApplication extends Application {
  protected declare readonly config: CommandApplicationConfig;

  constructor(config: CommandApplicationConfig) {
    super(config);
  }

  public async start(props: StartCommandApplicationProps): Promise<void> {
    try {
      // Initialize commander
      const commanderCommand = new Command();
      commanderCommand.argument('<command>', 'Command name');

      // Parse command line arguments
      const { args } = await commanderCommand.parseAsync(process.argv);

      // Get command name
      const commandName = args[0];

      // Pre-start
      const { redisInstance } = await this.onPreStart(props);

      // Start
      await this.startCallback({ redisInstance, commandName });

      // Post-start
      await this.onPostStart();

      // Stop
      await this.stop();
    } catch (error) {
      // Log error
      logger.error(error);

      // Exit with error
      process.exit(1);
    }
  }

  /**
   * Start command application callback
   */
  protected async startCallback({
    redisInstance,
    commandName,
  }: {
    redisInstance: RedisInstance;
    commandName: string;
  }): Promise<void> {
    logger.debug('Run command', { Command: commandName });

    const commands = await loadModulesInDirectory({
      directory: this.config.directory,
      extensions: ['.ts'],
    });

    console.log('commands', commands);
    

    if (!commands[commandName]) {
      throw new Error(`Command not found (Name: ${commandName})`);
    }

    const CommandClass: CommandType = commands[commandName];

    // Initialize command instance
    const commandInstance = new CommandClass({
      redisInstance: redisInstance,
      // databaseInstance: databaseInstance,
    });

    await commandInstance.execute();
  }

  /**
   * Stop command application callback
   */
  protected async stopCallback(): Promise<void> {
    logger.debug('Stop command application');
  }
}
