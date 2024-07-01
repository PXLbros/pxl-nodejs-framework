import { WebSocketRoute } from '../websocket.interface.js';

const webSocketSystemRoutes: WebSocketRoute[] = [
  { type: 'system', action: 'clientList', controllerName: 'system' },
];
