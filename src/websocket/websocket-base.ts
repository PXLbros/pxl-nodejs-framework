import { existsSync } from 'fs';
import { WebSocketRoute, WebSocketMessageHandler } from './websocket.interface.js';
import { log, getRouteKey, parseServerMessage } from './utils.js';
import { WebSocketBaseControllerType } from './controller/base.interface.js';
import WebSocket from 'ws';
import { Helper, Loader } from '../util/index.js';

export default abstract class WebSocketBase {
  protected routes: WebSocketRoute[] = [];
  protected routeHandlers: Map<string, WebSocketMessageHandler> = new Map();

  protected defaultRoutes: WebSocketRoute[] = [];

  protected abstract getControllerDependencies(): any;
  protected abstract shouldPrintRoutes(): boolean;
  protected abstract handleMessageError(clientId: string, error: string): void;

  protected async configureRoutes(routes: WebSocketRoute[], controllersDirectory: string): Promise<void> {
    const controllersDirectoryExists = await existsSync(controllersDirectory);

    if (!controllersDirectoryExists) {
      log('Controllers directory not found', { Directory: controllersDirectory });

      return;
    }

    // Load controllers
    const controllers = await Loader.loadModulesInDirectory({
      directory: controllersDirectory,
      extensions: ['.js'],
    });

    for (const route of routes) {
      let ControllerClass: WebSocketBaseControllerType;

      if (route.controller) {
        ControllerClass = route.controller;
      } else if (route.controllerName) {
        ControllerClass = controllers[route.controllerName];
      } else {
        throw new Error('WebSocket controller config not found');
      }

      if (typeof ControllerClass !== 'function') {
        log('Controller not found', {
          Controller: route.controllerName,
          Path: `${controllersDirectory}/${route.controllerName}.ts`
        });

        continue;
      }

      const controllerInstance = new ControllerClass(this.getControllerDependencies());

      const controllerHandler = controllerInstance[route.action as keyof typeof controllerInstance] as WebSocketMessageHandler;

      this.routeHandlers.set(getRouteKey(route.type, route.action), controllerHandler);
    }

    if (this.shouldPrintRoutes()) {
      log('Routes:');

      console.log(this.printRoutes());
    }
  }

  protected async handleServerMessage(ws: WebSocket, message: WebSocket.Data, clientId: string): Promise<void> {
    try {
      const parsedMessage = parseServerMessage(message);
      const action = parsedMessage.action;
      const type = parsedMessage.type;

      log('Incoming message', {
        'Client ID': clientId,
        Type: type ?? '-',
        Action: action ?? '-',
      });

      const routeKey = getRouteKey(parsedMessage.type as string, parsedMessage.action as string);

      const messageHandler = this.routeHandlers.get(routeKey);

      if (!messageHandler) {
        throw new Error(`Route handler not found (Route: ${routeKey})`);
      }

      const messageResponse = await messageHandler(ws, clientId, parsedMessage.data);

      if (messageResponse?.error) {
        throw new Error(messageResponse.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      log(errorMessage);

      this.handleMessageError(clientId, errorMessage);
    }
  }

  protected printRoutes(): string {
    let routesString = '';

    const routeKeys = Array.from(this.routeHandlers.keys());

    routeKeys.forEach((routeKey, index) => {
      const [type, action] = routeKey.split(':');

      routesString += `Type: ${type} -> Action: ${action}`;

      if (index !== routeKeys.length - 1) {
        routesString += '\n';
      }
    });

    return routesString;
  }
}
