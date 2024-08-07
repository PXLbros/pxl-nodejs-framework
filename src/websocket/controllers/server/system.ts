import { WebSocket } from 'ws';
import WebSocketServerBaseController from '../../controller/server/base.js';
import logger from '../../../logger/logger.js';
import { Logger } from '../../../logger/index.js';

export default class SystemController extends WebSocketServerBaseController {
  public joinRoom = (clientWebSocket: WebSocket, webSocketClientId: string, data: any): any => {
    const userId = data.userId || null;
    const userType = data.userType || null;
    const username = data.username || null;

    try {
      // Join room
      this.webSocketServer.joinRoom({
        ws: clientWebSocket,
        userId,
        userType,
        username,
        roomName: data.roomName,
      });

      return {
        success: true,
        data: {
          roomName: data.roomName,
        },
      };
    } catch (error) {
      Logger.error(error);

      return {
        error
      };
    }
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
