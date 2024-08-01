import WebSocket from 'ws';

export interface WebSocketClientData {
  ws: WebSocket | null;
  lastActivity: number;
  [key: string]: any;
}
