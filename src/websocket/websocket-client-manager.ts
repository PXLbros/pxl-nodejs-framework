import WebSocket from 'ws';
import { log } from './utils.js';
import { WebSocketClientData } from './websocket-client-manager.interface.js';
import WebSocketRoomManager from './websocket-room-manager.js';
import { Helper, Time } from '../util/index.js';
import cluster from 'cluster';

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
    requireWs,
  }: {
    clientId: string;
    requireWs?: boolean;
  }): WebSocketClientData | undefined {
    const client = this.clients.get(clientId);

    if (requireWs && !client?.ws) {
      return undefined;
    }

    return client;
  }

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
      roomName?: string;
    }[] = [];

    this.clients.forEach(({ lastActivity, roomName }, clientId) => {
      clientList.push({
        clientId,
        lastActivity,
        roomName,
      });
    });

    return clientList;
  }

  public getClientByKey({
    key,
    value,
    requireWs,
  }: {
    key: string;
    value: string;
    requireWs?: boolean;
  }) {
    const client = [...this.clients.entries()].find(
      ([_, clientData]) => {
        const deepKeyValue = Helper.getValueFromObject(clientData, key);

        const value2 = deepKeyValue === value;

        return value2;
      }
    );

    const formattedClient = client ? {
      clientId: client[0],
      ...client[1],
    } : undefined;

    if (requireWs && !formattedClient?.ws) {
      return undefined;
    }

    return formattedClient;
  }

  public disconnectClient({ clientId }: { clientId: string }) {
    const clientInfo = this.clients.get(clientId);

    // TODO: Need to check if the client to be disconnected WS is on this worker that received the request, otherwise need to request to Redis and let all workers check
    // console.log('disconnected client, has ws?: ' , clientInfo?.ws ? 'yes' : 'no');

    if (clientInfo?.ws) {
      const connectedTime = Date.now() - clientInfo.lastActivity;

      clientInfo.ws.close();

      log(
        'WebSocket client was disconnected due to inactivity',
        {
          ID: clientId,
          'Time Connected': Time.formatTime({
            time: connectedTime,
            format: 's',
          }),
        },
      );
    }

    this.removeClient(clientId);

    log('Client disconnected', { ID: clientId });

    this.printClients();
  }

  public printClients() {
    const numClients = this.clients.size;

    const workerId = cluster.isWorker && cluster.worker ? cluster.worker.id : null;

    let logOutput = '\n-------------------------------------\n';
    logOutput += `Connected clients (Count: ${numClients} | Worker: ${workerId}):\n`;
    logOutput += '-------------------------------------\n';

    if (numClients > 0) {
      this.clients.forEach((clientData, clientId) => {
        logOutput += `ID: ${clientId} | Email: ${clientData.user ? clientData.user.email : '-'}\n`;
      });
    } else {
      logOutput += 'No clients';
    }

    logOutput += '\n';

    log(logOutput, undefined, {
      muteWorker: true,
    });
  }

  public broadcastClientList(type: string) {
    const clientList = this.getClientList();

    this.clients.forEach(({ ws }) => {
      if (!ws) {
        return;
      }

      console.log('sending clinent list to client: ', ws.url);


      ws.send(
        JSON.stringify({
          type: 'system',
          action: 'clientList',
          clientListType: type,
          data: clientList,
        }),
      );
    });
  }
}
