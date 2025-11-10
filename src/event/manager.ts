// event-manager.ts
import { Logger } from '../logger/index.js';
import { File, Helper, Loader } from '../util/index.js';
import type {
  EventDefinition,
  EventHandler,
  EventManagerConstructorParams,
  EventManagerOptions,
} from './manager.interface.js';
import type { ApplicationConfig } from '../application/base-application.interface.js';
import type DatabaseInstance from '../database/instance.js';
import type { RedisInstance } from '../redis/index.js';
import type { EventControllerType } from './controller/base.interface.js';

export default class EventManager {
  private logger: typeof Logger = Logger;

  private applicationConfig: ApplicationConfig;
  private options: EventManagerOptions;
  private events: EventDefinition[];
  private redisInstance: RedisInstance;
  // private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance | null;

  private eventHandlers: Map<string, EventHandler>;

  constructor(params: EventManagerConstructorParams) {
    const defaultOptions: Partial<EventManagerOptions> = {
      log: {
        startUp: true,
      },
      debug: {
        printEvents: false,
      },
    };

    this.options = Helper.defaultsDeep(params.options, defaultOptions);

    this.applicationConfig = params.applicationConfig;
    this.events = params.events;
    this.redisInstance = params.redisInstance;
    // this.queueManager = params.queueManager;
    this.databaseInstance = params.databaseInstance;

    this.eventHandlers = new Map();
  }

  public async load(): Promise<void> {
    // Check if controllers directory exists
    const controllersDirectoryExists = await File.pathExists(this.options.controllersDirectory);

    if (!controllersDirectoryExists) {
      return;
    }

    // Load controllers
    const controllers = await Loader.loadModulesInDirectory({
      directory: this.options.controllersDirectory,
      extensions: ['.ts', '.js'],
    });

    // Load event handlers
    for (const event of this.events) {
      let ControllerClass: EventControllerType;
      let controllerName: string;

      if (event.controller) {
        ControllerClass = event.controller;
        controllerName = ControllerClass.name;
      } else if (event.controllerName) {
        ControllerClass = controllers[event.controllerName] as EventControllerType;
        controllerName = event.controllerName;
      } else {
        throw new Error('Event controller not specified');
      }

      if (typeof ControllerClass !== 'function') {
        const controllerPath = `${this.options.controllersDirectory}/${event.controllerName}.ts`;
        this.logger.warn({
          message: 'Event controller not found',
          meta: {
            Controller: event.controllerName,
            Path: controllerPath,
            Event: event.name,
          },
        });
        continue;
      }

      // Initialize controller instance
      const controllerInstance = new ControllerClass({
        applicationConfig: this.applicationConfig,
        redisInstance: this.redisInstance,
        // queueManager: this.queueManager,
        databaseInstance: this.databaseInstance,
      });

      const handler = controllerInstance[event.handlerName as keyof typeof controllerInstance];

      if (!handler || typeof handler !== 'function') {
        this.logger.warn({
          message: 'Event handler not found',
          meta: {
            Controller: controllerName,
            Handler: event.handlerName,
            Event: event.name,
          },
        });
        continue;
      }

      // Store the handler
      this.eventHandlers.set(event.name, (handler as EventHandler).bind(controllerInstance));
    }

    // Log the list of registered events
    const registeredEvents = Array.from(this.eventHandlers.keys());

    this.log('Registered events', {
      Events: registeredEvents.length ? registeredEvents : 'None',
    });

    if (this.options.debug?.printEvents) {
      this.logger.custom({
        level: 'event',
        message: `Registered events:\n${registeredEvents.map(e => `- ${e}`).join('\n')}`,
      });
    }
  }

  public async run<TPayload = unknown>({ name, data }: { name: string; data: TPayload }): Promise<void> {
    try {
      const handler = this.eventHandlers.get(name);

      if (!handler) {
        const availableEvents = Array.from(this.eventHandlers.keys()).join(', ');

        this.logger.warn({
          message: 'Event handler not found for event',
          meta: {
            Event: name,
            AvailableEvents: availableEvents,
          },
        });

        throw new Error(`Event handler not found for event '${name}'. Available events are: ${availableEvents}`);
      }

      await handler(data);

      this.log('Event executed', { Event: name });
    } catch (error) {
      this.logger.error({ error });
    }
  }

  /**
   * Log event message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom({ level: 'event', message, meta });
  }
}
