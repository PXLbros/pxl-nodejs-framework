import { calculateElapsedTime } from 'src/util/time';
import Application from '../application';
import CommandApplicationInstance from './command-application-instance';
import { StartCommandApplicationProps } from './command-application.interface';

export default class CommandApplication extends Application {
  /**
   * Start command application
   */
  public async start(props?: StartCommandApplicationProps): Promise<void> {
    const commandApplicationInstance = await this.startInstance(props);

    // Run command
    commandApplicationInstance.runCommand();

    // Shutdown command application instance
    commandApplicationInstance.shutdown();

    // this.handleShutdown({ applicationInstance: commandApplicationInstance });
  }

  /**
   * Start command application instance
   */
  protected async startInstance(props?: StartCommandApplicationProps): Promise<CommandApplicationInstance> {
    const { redisInstance } = await this.connect();

    const commandApplicationInstance = new CommandApplicationInstance({
      redisInstance,

      events: {
        onStopped: props?.onStopped,
      },
    });

    // Calculate startup time
    const startupTime = calculateElapsedTime({ startTime: this.startTime });

    if (props?.onStarted) {
      // Emit started event
      props.onStarted({ startupTime });
    }

    return commandApplicationInstance;
  }

  /**
   * Stop command application
   */
  protected async stopInstance(): Promise<void> {}
}
