import WebSocket from 'ws';
import { log } from './utils.js';
import { WebSocketClientData } from './websocket-client-manager.interface.js';

export default class WebSocketClientManager {
  private clients: Map<string, WebSocketClientData> = new Map();

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

  public getClientId({
    ws,
  }: {
    ws: WebSocket;
  }): string | undefined {
    return [...this.clients.entries()].find(
      ([_, value]) => value.ws === ws,
    )?.[0];
  }

  public getClient({
    clientId,
  }: {
    clientId: string;
  }): WebSocketClientData | undefined {
    return this.clients.get(clientId);
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

  public removeClient(clientId: string) {
    this.clients.delete(clientId);

    this.broadcastClientList('removeClient');

    this.printClients();
  }

  public getClientList() {
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

    if (numClients > 0) {
      this.clients.forEach((clientData, clientId) => {
        logStr += `  ID: ${clientId} | Email: ${clientData.user ? clientData.user.email : '-'}\n`;
      });
    } else {
      logStr += 'No clients';
    }

    logStr += '\n';

    log(logStr);
  }

  public broadcastClientList(type: string) {
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
