import type { WebSocketMessageHandler, WebSocketRoute, WebSocketType } from './websocket.interface.js';
import { getRouteKey, log, parseServerMessage } from './utils.js';
import type { WebSocketServerBaseControllerType } from './controller/server/base.interface.js';
import type { WebSocketClientBaseControllerType } from './controller/client/base.interface.js';
import type WebSocket from 'ws';
import { File, Helper, Loader } from '../util/index.js';

export default abstract class WebSocketBase {
  protected routes: WebSocketRoute[] = [];
  protected routeHandlers: Map<string, WebSocketMessageHandler> = new Map();

  protected defaultRoutes: WebSocketRoute[] = [];

  public abstract get type(): WebSocketType;

  protected abstract getControllerDependencies(): Record<string, unknown>;
  protected abstract shouldPrintRoutes(): boolean;
  protected abstract handleMessageError(clientId: string, error: string): void;

  protected async configureRoutes(routes: WebSocketRoute[], controllersDirectory: string): Promise<void> {
    // log ('Configuring routes', { Type: this.type, 'Controllers Directory': controllersDirectory });

    const controllersDirectoryExists = await File.pathExists(controllersDirectory);

    if (!controllersDirectoryExists) {
      log('Controllers directory not found', {
        Directory: controllersDirectory,
      });

      return;
    }

    const scriptFileExtension = Helper.getScriptFileExtension();

    // Load controllers
    const controllers = await Loader.loadModulesInDirectory({
      directory: controllersDirectory,
      // NOTE:
      // When getting "system", it gets /app/node_modules/@scpxl/nodejs-framework/dist/websocket/controllers/server
      // Therefor .js is needed also
      // Fix so only .ts vs .js is needed
      extensions: ['.ts', '.js'],
    });

    for (const route of routes) {
      let ControllerClass: WebSocketServerBaseControllerType | WebSocketClientBaseControllerType;

      // log('Registering route', {
      //   Type: route.type,
      //   Controller: route.controller ? route.controller.toString() : route.controllerName,
      //   Action: route.action,
      // });

      if (route.controller) {
        ControllerClass = route.controller;
      } else if (route.controllerName) {
        ControllerClass = controllers[route.controllerName] as
          | WebSocketServerBaseControllerType
          | WebSocketClientBaseControllerType;
      } else {
        throw new Error('WebSocket controller config not found');
      }

      if (typeof ControllerClass !== 'function') {
        log('Controller not found', {
          Controller: route.controllerName,
          Path: `${controllersDirectory}/${route.controllerName}.${scriptFileExtension}`,
        });

        continue;
      }

      const controllerDependencies = this.getControllerDependencies();

      const controllerInstance = new ControllerClass(controllerDependencies as any);

      const controllerHandler = controllerInstance[route.action as keyof typeof controllerInstance] as
        | WebSocketMessageHandler
        | undefined;
      const routeKey = getRouteKey(route.type, route.action);

      if (typeof controllerHandler !== 'function') {
        log('Controller action not found', {
          Controller: route.controllerName ?? ControllerClass.name,
          Action: route.action,
          RouteKey: routeKey,
        });
        continue;
      }

      this.routeHandlers.set(routeKey, controllerHandler.bind(controllerInstance));
    }

    if (this.shouldPrintRoutes()) {
      log('Routes:', { Type: this.type });

      this.printRoutes();
    }
  }

  protected async handleServerMessage(
    ws: WebSocket,
    message: WebSocket.Data,
    clientId: string,
  ): Promise<{ type: unknown; action: unknown; response: unknown } | void> {
    try {
      const parsedMessage = parseServerMessage(message);
      const type = parsedMessage.type;
      const action = parsedMessage.action;

      log('Incoming message', {
        'Client ID': clientId,
        Type: type ?? '-',
        Action: action ?? '-',
      });

      const routeKey = getRouteKey(parsedMessage.type as string, parsedMessage.action as string);

      const messageHandler = this.routeHandlers.get(routeKey);

      if (messageHandler) {
        const messageResponse = await messageHandler(ws, clientId, parsedMessage.data);

        return {
          type,
          action,
          response: messageResponse,
        };
      }
      // throw new Error(`Route handler not found (Route Key: ${routeKey} | Type: ${type} | Action: ${action})`);

      log('Route handler not found', {
        RouteKey: routeKey,
        Type: type,
        Action: action,
      });

      // if (
      //   typeof this.applicationConfig.webSocket
      //     ?.serverMessageHandler === 'function'
      // ) {
      //   // Execute custom application subscriber event handler
      //   this.applicationConfig.webSocket.serverMessageHandler(
      //     {
      //       ws,
      //       clientId,
      //       parsedMessage,
      //     },
      //   );
      // }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      log(errorMessage);

      this.handleMessageError(clientId, errorMessage);
    }
  }

  protected printRoutes(): void {
    let routesString = '';

    const routeKeys = Array.from(this.routeHandlers.keys());

    routeKeys.forEach((routeKey, index) => {
      const [type, action] = routeKey.split(':');

      routesString += `Type: ${type} -> Action: ${action}`;

      if (index !== routeKeys.length - 1) {
        routesString += '\n';
      }
    });

    log(routesString);
  }
}
