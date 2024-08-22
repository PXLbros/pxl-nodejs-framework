import WebSocket from 'ws';
import { log } from './utils.js';
import { WebSocketClientData } from './websocket-client-manager.interface.js';
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
    broadcastClientList,
  }: {
    clientId: string;
    key: string;
    data: any;
    broadcastClientList?: boolean;
  }) {
    const client = this.clients.get(clientId);

    if (!client) {
      return;
    }

    client[key] = data;

    this.clients.set(clientId, client);

    if (broadcastClientList !== false) {
      this.broadcastClientList('updateClient');
    }

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
      [key: string]: any;
    }[] = [];

    this.clients.forEach((clientData, clientId) => {
      clientList.push({
        clientId,
        ...clientData,
      });
    });

    return clientList;
  }

  public getClientByKey({
    key,
    value,
    requireWs,
    userType,
  }: {
    key: string;
    value: string;
    requireWs?: boolean;
    userType?: string;
  }) {
    const clients = [...this.clients.entries()];

    const client = clients.find(
      ([_, clientData]) => {
        const deepKeyValue = Helper.getValueFromObject(clientData, key);

        const isValueMatching = deepKeyValue === value;

        if (userType && clientData.user?.userType !== userType) {
          return false;
        }

        return isValueMatching;
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

  public getClients({ userType }: { userType?: string } = {}) {
    const clients: WebSocketClientData[] = [];

    this.clients.forEach((clientData, clientId) => {
      if (userType && clientData.user?.userType !== userType) {
        return;
      }

      clientData.clientId = clientId;

      clients.push(clientData);
    });

    return clients;
  }

  public disconnectClient({ clientId }: { clientId: string }) {
    const clientInfo = this.clients.get(clientId);

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

    let logOutput = '\n-------------------------------------------------------\n';
    logOutput += `Connected clients (Count: ${numClients} | Worker: ${workerId}):\n`;
    logOutput += '-------------------------------------------------------\n';

    if (numClients > 0) {
      this.clients.forEach((client, clientId) => {
        logOutput += `ID: ${clientId} | Username: ${client?.user?.username || '-'} | User Type: ${client?.user?.userType || '-'} | Email: ${client.user?.email ? client.user.email : '-'}\n`;
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
