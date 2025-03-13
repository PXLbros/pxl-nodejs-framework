import { WebSocket } from 'ws';
import { WebSocketClientBaseController } from '../../index.js';
export default class SystemController extends WebSocketClientBaseController {
    clientList: (clientWebSocket: WebSocket, webSocketClientId: string, data: any) => any;
}
//# sourceMappingURL=system.d.ts.map