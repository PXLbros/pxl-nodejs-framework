import type { WebSocket } from 'ws';
import WebSocketServerBaseController from '../../controller/server/base.js';
import { Logger } from '../../../logger/index.js';

export default class SystemController extends WebSocketServerBaseController {
  public joinRoom = (clientWebSocket: WebSocket, webSocketClientId: string, data: any): any => {
    const userId = data.userId ?? webSocketClientId;
    const userType = data.userType ?? 'user';
    const username = data.username ?? `user_${webSocketClientId.substring(0, 8)}`;
    const roomName = data.roomName;

    if (!roomName) {
      return {
        success: false,
        error: 'Room name is required',
        clientId: webSocketClientId,
      };
    }

    try {
      // Join room
      this.webSocketServer.joinRoom({
        ws: clientWebSocket,
        userId,
        userType,
        username,
        roomName,
      });

      return {
        success: true,
        message: `Successfully joined room: ${roomName}`,
        data: {
          userId,
          userType,
          username,
          roomName,
          joinedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      Logger.error({ error, message: 'Failed to join room via system controller' });

      return {
        success: false,
        error: 'Failed to join room',
        message: error instanceof Error ? error.message : 'Unknown error',
        clientId: webSocketClientId,
      };
    }
  };

  public leaveRoom = (clientWebSocket: WebSocket, webSocketClientId: string, data: any): any => {
    const roomName = data.roomName;

    if (!roomName) {
      return {
        success: false,
        error: 'Room name is required',
        clientId: webSocketClientId,
      };
    }

    try {
      // Leave room
      this.webSocketServer.leaveRoom({
        ws: clientWebSocket,
        roomName,
      });

      return {
        success: true,
        message: `Successfully left room: ${roomName}`,
        data: {
          roomName,
          leftAt: new Date().toISOString(),
        },
        clientId: webSocketClientId,
      };
    } catch (error) {
      Logger.error({ error, message: 'Failed to leave room via system controller' });

      return {
        success: false,
        error: 'Failed to leave room',
        message: error instanceof Error ? error.message : 'Unknown error',
        clientId: webSocketClientId,
      };
    }
  };
}
