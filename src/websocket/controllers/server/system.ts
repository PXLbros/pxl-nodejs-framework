import { WebSocket } from 'ws';
import WebSocketServerBaseController from '../../controller/server/base.js';
import logger from '../../../logger/logger.js';

export default class SystemController extends WebSocketServerBaseController {
  public clientList = (clientWebSocket: WebSocket, webSocketClientId: string, data: any): any => {
    console.log('client list receieved (server): ', data);

    // update internal client list
    // this.webSocketServer.updateClientList();
  }

  public joinRoom = (clientWebSocket: WebSocket, webSocketClientId: string, data: any): any => {
    if (!data?.userId) {
      logger.warn('Missing user ID when joining room');

      return { error: 'No user ID provided' };
    }

    const userId = data.userId;

    // Join room
    this.webSocketServer.joinRoom({ ws: clientWebSocket, userId, roomName: data.roomName });
  }

  public leaveRoom = (clientWebSocket: WebSocket, webSocketClientId: string, data: any): any => {
    if (!data?.userId) {
      logger.warn('Missing user ID when leaving room');

      return { error: 'No user ID provided' };
    }

    // Leave room
    this.webSocketServer.leaveRoom({ ws: clientWebSocket, roomName: data.roomName });
  }
}
