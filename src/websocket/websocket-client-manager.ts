import WebSocket from 'ws';
import { WebSocketConnectedClientData } from './websocket.interface.js';
import { log } from './utils.js';

export default class WebSocketClientManager {
  private clients: Map<
    string,
    {
      ws: WebSocket | null;
      lastActivity: number;
      [key: string]: any; // Add index signature
    }
  > = new Map();

  public addClient({
    clientId,
    ws,
    lastActivity,
  }: {
    clientId: string;
    ws: WebSocket | null;
    lastActivity: number;
  }) {
    this.clients.set(clientId, {
      ws,
      lastActivity: lastActivity,
    });

    this.broadcastClientList('addClient');

    log('Client connected', { ID: clientId });

    this.printClients();
  }

  public getClientId({ ws }: { ws: WebSocket }): string | undefined {
    return [...this.clients.entries()].find(
      ([_, value]) => value.ws === ws,
    )?.[0];
  }

  // this.clientManager.updateClient({
  //   clientId,
  //   key: 'user',
  //   data: userData,
  // });
  public updateClient({
    clientId,
    key,
    data,
  }: {
    clientId: string;
    key: string;
    data: any;
  }) {
    const client = this.clients.get(clientId);

    if (!client) {
      return;
    }

    client[key] = data;

    this.clients.set(clientId, client);

    this.broadcastClientList('updateClient');

    this.printClients();
  }

  removeClient(clientId: string) {
    this.clients.delete(clientId);

    this.broadcastClientList('removeClient');
  }

  getClientList() {
    const clientList: {
      clientId: string;
      lastActivity: number;
    }[] = [];

    this.clients.forEach(({ lastActivity }, clientId) => {
      clientList.push({
        clientId,
        lastActivity,
      });
    });

    return clientList;
  }

  public printClients() {
    const numClients = this.clients.size;

    let logStr = `Connected clients (${numClients}):\n`;

    this.clients.forEach((clientData, clientId) => {
      logStr += `  ID: ${clientId} | Email: ${clientData.user ? clientData.user.email : '-'}\n`;
    });

    log(logStr);
  }

  broadcastClientList(type: string) {
    const clientList = this.getClientList();

    this.clients.forEach(({ ws }) => {
      if (!ws) {
        return;
      }

      ws.send(
        JSON.stringify({
          type,
          data: clientList,
        }),
      );
    });
  }
}
