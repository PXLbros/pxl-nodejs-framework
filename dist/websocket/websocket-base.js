import { existsSync } from 'fs';
import { log, getRouteKey, parseServerMessage } from './utils.js';
import { Helper, Loader } from '../util/index.js';
export default class WebSocketBase {
    routes = [];
    routeHandlers = new Map();
    defaultRoutes = [];
    async configureRoutes(routes, controllersDirectory) {
        // log ('Configuring routes', { Type: this.type, 'Controllers Directory': controllersDirectory });
        const controllersDirectoryExists = await existsSync(controllersDirectory);
        if (!controllersDirectoryExists) {
            log('Controllers directory not found', { Directory: controllersDirectory });
            return;
        }
        const scriptFileExtension = Helper.getScriptFileExtension();
        // Load controllers
        const controllers = await Loader.loadModulesInDirectory({
            directory: controllersDirectory,
            // NOTE:
            // When getting "system", it gets /app/node_modules/@pxl/nodejs-framework/dist/websocket/controllers/server
            // Therefor .js is needed also
            // Fix so only .ts vs .js is needed
            extensions: ['.ts', '.js'],
        });
        for (const route of routes) {
            let ControllerClass;
            // log('Registering route', {
            //   Type: route.type,
            //   Controller: route.controller ? route.controller.toString() : route.controllerName,
            //   Action: route.action,
            // });
            if (route.controller) {
                ControllerClass = route.controller;
            }
            else if (route.controllerName) {
                ControllerClass = controllers[route.controllerName];
            }
            else {
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
            const controllerInstance = new ControllerClass(controllerDependencies);
            const controllerHandler = controllerInstance[route.action];
            const routeKey = getRouteKey(route.type, route.action);
            this.routeHandlers.set(routeKey, controllerHandler);
        }
        if (this.shouldPrintRoutes()) {
            log('Routes:', { Type: this.type });
            this.printRoutes();
        }
    }
    async handleServerMessage(ws, message, clientId) {
        try {
            const parsedMessage = parseServerMessage(message);
            const type = parsedMessage.type;
            const action = parsedMessage.action;
            log('Incoming message', {
                'Client ID': clientId,
                Type: type ?? '-',
                Action: action ?? '-',
            });
            const routeKey = getRouteKey(parsedMessage.type, parsedMessage.action);
            const messageHandler = this.routeHandlers.get(routeKey);
            if (messageHandler) {
                const messageResponse = await messageHandler(ws, clientId, parsedMessage.data);
                return {
                    type,
                    action,
                    response: messageResponse,
                };
            }
            else {
                // throw new Error(`Route handler not found (Route Key: ${routeKey} | Type: ${type} | Action: ${action})`);
                log('Route handler not found', { RouteKey: routeKey, Type: type, Action: action });
            }
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log(errorMessage);
            this.handleMessageError(clientId, errorMessage);
        }
    }
    printRoutes() {
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
//# sourceMappingURL=websocket-base.js.map