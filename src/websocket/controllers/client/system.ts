import { WebSocket } from 'ws';
import WebSocketServerBaseController from '../../controller/server/base.js';

export default class SystemController extends WebSocketServerBaseController {
  public clientList = (clientWebSocket: WebSocket, webSocketClientId: string, data: any): any => {
    console.log('client list receieved (client): ', data);

    // update internal client list
    // this.webSocketServer.updateClientList();
  }

  public clientJoin = (clientWebSocket: WebSocket, webSocketClientId: string, data: any): any => {
    console.log('client join (client): ', data);

    // update internal client list
    // this.webSocketServer.updateClientList();
  }
}
