import type WebSocket from 'ws';

export interface WebSocketClientData {
  ws: WebSocket | null;
  lastActivity: number;
  roomName?: string;
  [key: string]: any;
}
