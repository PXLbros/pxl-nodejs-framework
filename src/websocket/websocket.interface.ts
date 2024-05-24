import { WebSocket } from 'ws';
import DatabaseInstance from '../database/instance.js';
import QueueManager from '../queue/manager.js';
import RedisInstance from '../redis/instance.js';
import { WebSocketBaseControllerType } from './controller/base.interface.js';

export interface WebSocketOptions {
  host: string;
  port: number;
  controllersDirectory: string;
}

export interface WebSocketRoute {
  type: string;
  controllerName: string;
  controller?: WebSocketBaseControllerType;
  action: string;
}

export interface WebSocketConstructorParams {
  options: WebSocketOptions;
  routes: WebSocketRoute[];
  redisInstance: RedisInstance;
  queueManager: QueueManager;
  databaseInstance: DatabaseInstance;
}

export interface WebSocketConnectedClientData {
  ws: WebSocket | null;
  lastActivity: number;
  userName?: string;
}

export interface WebSocketMessageHandler {
  (ws: WebSocket, clientId: string, data: any): void;
}

export enum WebSocketRedisSubscriberEvent {
  ClientConnected = 'clientConnected',
  ClientDisconnected = 'clientDisconnected',
  ClientJoined = 'clientJoined',
  SendMessageToAll = 'sendMessageToAll',
  MessageError = 'messageError',
  QueueJobCompleted = 'queueJobCompleted',
  QueueJobError = 'queueJobError',
}
