import { WebSocketRoute, WebSocketMessageHandler, WebSocketType } from './websocket.interface.js';
import WebSocket from 'ws';
export default abstract class WebSocketBase {
    protected routes: WebSocketRoute[];
    protected routeHandlers: Map<string, WebSocketMessageHandler>;
    protected defaultRoutes: WebSocketRoute[];
    abstract get type(): WebSocketType;
    protected abstract getControllerDependencies(): any;
    protected abstract shouldPrintRoutes(): boolean;
    protected abstract handleMessageError(clientId: string, error: string): void;
    protected configureRoutes(routes: WebSocketRoute[], controllersDirectory: string): Promise<void>;
    protected handleServerMessage(ws: WebSocket, message: WebSocket.Data, clientId: string): Promise<void | any>;
    protected printRoutes(): void;
}
//# sourceMappingURL=websocket-base.d.ts.map