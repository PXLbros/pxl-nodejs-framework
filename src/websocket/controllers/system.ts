import { Logger, WebSocketBaseController } from '@pxl/nodejs-framework';
import { WebSocket } from 'ws';

export default class SystemController extends WebSocketBaseController {
  public clientList = (clientWebSocket: WebSocket, webSocketClientId: string, data: any): any => {
    Logger.info('Client list requested', { clientId: webSocketClientId });
  }
}
