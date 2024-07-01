import { existsSync } from 'fs';
import { WebSocketRoute, WebSocketMessageHandler } from './websocket.interface.js';
import { log, getRouteKey } from './utils.js';
import { WebSocketBaseControllerType } from './controller/base.interface.js';

export default abstract class WebSocketBase {
  protected routes: WebSocketRoute[] = [];
  protected routeHandlers: Map<string, WebSocketMessageHandler> = new Map();

  protected async configureRoutes(controllersDirectory: string, controllers: Record<string, WebSocketBaseControllerType>): Promise<void> {
    const controllersDirectoryExists = await existsSync(controllersDirectory);
    if (!controllersDirectoryExists) {
      log('Controllers directory not found', { Directory: controllersDirectory });
      return;
    }

    for (const route of this.routes) {
      let ControllerClass: WebSocketBaseControllerType;
      if (route.controller) {
        ControllerClass = route.controller;
      } else if (route.controllerName) {
        ControllerClass = controllers[route.controllerName];
      } else {
        throw new Error('WebSocket controller config not found');
      }

      if (typeof ControllerClass !== 'function') {
        log('Controller not found', { Controller: route.controllerName, Path: `${controllersDirectory}/${route.controllerName}.ts` });
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

  protected abstract getControllerDependencies(): any;

  protected abstract shouldPrintRoutes(): boolean;

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
