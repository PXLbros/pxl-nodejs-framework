import type { WebSocket } from 'ws';
// import WebSocketServerBaseController from '../../controller/server/base.js';
import { WebSocketClientBaseController } from '../../index.js';

export default class SystemController extends WebSocketClientBaseController {
  public clientList = (_clientWebSocket: WebSocket, _webSocketClientId: string, _data: any): any => {
    // console.log('client list receieved (client): ', data);
  };
}
