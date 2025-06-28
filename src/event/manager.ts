// event-manager.ts
import { existsSync } from 'fs';
import { Logger } from '../logger/index.js';
import { Loader, Helper } from '../util/index.js';
import {
  EventManagerConstructorParams,
  EventManagerOptions,
  EventDefinition,
} from './manager.interface.js';
import { ApplicationConfig } from '../application/base-application.interface.js';
import DatabaseInstance from '../database/instance.js';
import QueueManager from '../queue/manager.js';
import { RedisInstance } from '../redis/index.js';
import { EventControllerType } from './controller/base.interface.js';

export default class EventManager {
  private logger: typeof Logger = Logger;

  private applicationConfig: ApplicationConfig;
  private options: EventManagerOptions;
  private events: EventDefinition[];
  private redisInstance: RedisInstance;
  // private queueManager: QueueManager;
  private databaseInstance: DatabaseInstance | null;

  private eventHandlers: Map<string, Function>;

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
    const controllersDirectoryExists = existsSync(this.options.controllersDirectory);

    if (!controllersDirectoryExists) {
      this.logger.warn('Event controllers directory not found', {
        Directory: this.options.controllersDirectory,
      });
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
        ControllerClass = controllers[event.controllerName];
        controllerName = event.controllerName;
      } else {
        throw new Error('Event controller not specified');
      }

      if (typeof ControllerClass !== 'function') {
        const controllerPath = `${this.options.controllersDirectory}/${event.controllerName}.ts`;
        this.logger.warn('Event controller not found', {
          Controller: event.controllerName,
          Path: controllerPath,
          Event: event.name,
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
        this.logger.warn('Event handler not found', {
          Controller: controllerName,
          Handler: event.handlerName,
          Event: event.name,
        });
        continue;
      }

      // Store the handler
      this.eventHandlers.set(event.name, (handler as Function).bind(controllerInstance));
    }

    // Log the list of registered events
    const registeredEvents = Array.from(this.eventHandlers.keys());

    this.log('Registered Events:', { Events: registeredEvents.length ? registeredEvents : '-' });

    if (this.options.debug?.printEvents) {
      this.log('Registered Events:');

      for (const eventName of registeredEvents) {
        console.log(`- ${eventName}`);
      }
    }
  }

  public async run({ name, data }: { name: string; data: any }): Promise<void> {
    try {
      const handler = this.eventHandlers.get(name);

      if (!handler) {
        const availableEvents = Array.from(this.eventHandlers.keys()).join(', ');

        this.logger.warn('Event handler not found for event', {
          Event: name,
          AvailableEvents: availableEvents,
        });

        throw new Error(
          `Event handler not found for event '${name}'. Available events are: ${availableEvents}`
        );
      }

      await handler(data);

      this.log('Event executed', { Event: name });
    } catch (error) {
      this.logger.error(error);
    }
  }

  /**
   * Log event message
   */
  public log(message: string, meta?: Record<string, unknown>): void {
    this.logger.custom('event', message, meta);
  }
}
