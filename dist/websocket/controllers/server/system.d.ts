import { WebSocket } from 'ws';
import WebSocketServerBaseController from '../../controller/server/base.js';
export default class SystemController extends WebSocketServerBaseController {
    joinRoom: (clientWebSocket: WebSocket, webSocketClientId: string, data: any) => any;
    leaveRoom: (clientWebSocket: WebSocket, webSocketClientId: string, data: any) => any;
}
//# sourceMappingURL=system.d.ts.map