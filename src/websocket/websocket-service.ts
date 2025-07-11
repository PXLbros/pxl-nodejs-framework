import type WebSocketServer from './websocket-server.js';
import type RedisInstance from '../redis/instance.js';
import { WebSocketRedisSubscriberEvent } from './websocket.interface.js';

export interface WebSocketMessage {
  type: string;
  action: string;
  data?: any;
}

export interface WebSocketServiceOptions {
  webSocketServer?: WebSocketServer;
  redisInstance?: RedisInstance;
  workerId?: string;
}

export class WebSocketService {
  private webSocketServer?: WebSocketServer;
  private redisInstance?: RedisInstance;
  private workerId?: string;

  constructor(options: WebSocketServiceOptions = {}) {
    this.webSocketServer = options.webSocketServer;
    this.redisInstance = options.redisInstance;
    this.workerId = options.workerId;
  }

  /**
   * Send a message to all connected WebSocket clients
   */
  async broadcast(message: WebSocketMessage): Promise<void> {
    if (this.webSocketServer) {
      // Direct broadcast if we have access to the WebSocket server
      await this.webSocketServer.sendCustomMessage({
        data: message,
      });
    } else if (this.redisInstance) {
      // Use Redis pub/sub for cross-worker communication
      await this.redisInstance.publisherClient.publish(
        WebSocketRedisSubscriberEvent.Custom,
        JSON.stringify({
          ...message,
          workerId: this.workerId,
        }),
      );
    } else {
      throw new Error('WebSocket service requires either webSocketServer or redisInstance');
    }
  }

  /**
   * Send a message to specific clients by their IDs
   * Note: This requires direct access to WebSocket server and room functionality
   */
  async sendToClients(clientIds: string[], message: WebSocketMessage): Promise<void> {
    // Currently not implemented in the framework
    // For now, we'll broadcast to all clients
    await this.broadcast(message);
  }

  /**
   * Send a message to all clients in specific rooms
   */
  async sendToRooms(roomNames: string[], message: WebSocketMessage): Promise<void> {
    if (!this.webSocketServer) {
      throw new Error('Sending to specific rooms requires direct access to WebSocket server');
    }

    const clientIds: string[] = [];

    // Get all client IDs from the specified rooms
    for (const roomName of roomNames) {
      const room = this.webSocketServer.rooms.get(roomName);
      if (room) {
        clientIds.push(...Array.from(room));
      }
    }

    if (clientIds.length > 0) {
      await this.sendToClients(clientIds, message);
    }
  }

  /**
   * Convenience method for sending user-targeted messages
   */
  async sendUserMessage(action: string, data: any): Promise<void> {
    await this.broadcast({
      type: 'user',
      action,
      data,
    });
  }

  /**
   * Convenience method for sending system messages
   */
  async sendSystemMessage(action: string, data: any): Promise<void> {
    await this.broadcast({
      type: 'system',
      action,
      data,
    });
  }

  /**
   * Convenience method for sending error messages
   */
  async sendErrorMessage(action: string, error: any): Promise<void> {
    await this.broadcast({
      type: 'error',
      action,
      data: {
        message: error.message ?? 'An error occurred',
        code: error.code,
        details: error.details,
      },
    });
  }
}
