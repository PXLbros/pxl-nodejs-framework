import path from 'path';
import { Command } from 'commander';
import { DatabaseInstance, RedisInstance } from '~/lib';
import ApplicationManager from '~/lib/app/ApplicationManager';
import { loaderUtil, timeUtil } from '~/utils';
import { CommandType } from '~/lib/command/BaseCommand';

interface CommandApplicationConfig {}

type OnStartedCommandApplicationEvent = ({ commandName }: { commandName: string }) => void;
type OnCompletedCommandApplicationEvent = ({
  commandName,
  executionTime,
}: {
  commandName: string;
  executionTime: number;
}) => void;

interface CommandApplicationStartProps {
  events?: CommandApplicationEvents;
}

interface CommandApplicationEvents {
  onStarted?: OnStartedCommandApplicationEvent;
  onCompleted?: OnCompletedCommandApplicationEvent;
}

export default class CommandApplicationManager extends ApplicationManager {
  private config: CommandApplicationConfig;

  constructor(config: CommandApplicationConfig = {}) {
    super();

    this.config = config;
  }

  public async start(options?: CommandApplicationStartProps): Promise<void> {
    // Initialize commander
    const commanderCommand = new Command();
    commanderCommand.argument('<command>', 'Command name');

    // Parse command line arguments
    const { args } = await commanderCommand.parseAsync(process.argv);

    // Get command name
    const commandName = args[0];

    // Initialize
    const { redisInstance, databaseInstance } = await this.init();

    // Run command
    this.runCommand({ redisInstance, databaseInstance, commandName, events: options?.events });
  }

  protected async runCommand({
    redisInstance,
    databaseInstance,
    commandName,
    events,
  }: {
    redisInstance: RedisInstance;
    databaseInstance: DatabaseInstance;
    commandName: string;
    events?: CommandApplicationEvents;
  }): Promise<void> {
    const commands = await loaderUtil.loadModulesInDirectory({
      directory: path.join(__dirname, '../../commands'),
      extensions: ['.ts'],
    });

    if (!commands[commandName]) {
      throw new Error(`Command not found (Name: ${commandName})`);
    }

    const startTime = process.hrtime();

    const CommandClass: CommandType = commands[commandName];

    // Initialize command instance
    const commandInstance = new CommandClass({
      redisInstance: redisInstance,
      databaseInstance: databaseInstance,
    });

    if (events?.onStarted) {
      events?.onStarted({ commandName });
    }

    // Execute command
    await commandInstance.execute();

    // Calculate command execution time
    const executionTime = timeUtil.calculateElapsedTime({ startTime });

    if (events?.onCompleted) {
      events?.onCompleted({ commandName, executionTime: executionTime });
    }

    await this.stop({ redisInstance, databaseInstance });

    // Stop application
    process.exit(0);
  }
}
