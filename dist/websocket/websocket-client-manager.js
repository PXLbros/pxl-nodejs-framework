import { log } from './utils.js';
import { Helper, Time } from '../util/index.js';
import cluster from 'cluster';
export default class WebSocketClientManager {
    clients = new Map();
    addClient({ clientId, ws, lastActivity, }) {
        this.clients.set(clientId, {
            ws,
            lastActivity: lastActivity,
        });
        this.broadcastClientList('addClient');
        log('Client connected', { ID: clientId });
        this.printClients();
    }
    getClientId({ ws, }) {
        return [...this.clients.entries()].find(([_, value]) => value.ws === ws)?.[0];
    }
    getClient({ clientId, requireWs, }) {
        const client = this.clients.get(clientId);
        if (requireWs && !client?.ws) {
            return undefined;
        }
        return client;
    }
    updateClient({ clientId, key, data, broadcastClientList, }) {
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
    removeClient(clientId) {
        this.clients.delete(clientId);
        this.broadcastClientList('removeClient');
        this.printClients();
    }
    getClientList() {
        const clientList = [];
        this.clients.forEach((clientData, clientId) => {
            clientList.push({
                clientId,
                ...clientData,
            });
        });
        return clientList;
    }
    getClientByKey({ key, value, requireWs, userType, }) {
        const clients = [...this.clients.entries()];
        const client = clients.find(([_, clientData]) => {
            const deepKeyValue = Helper.getValueFromObject(clientData, key);
            const isValueMatching = deepKeyValue === value;
            if (userType && clientData.user?.userType !== userType) {
                return false;
            }
            return isValueMatching;
        });
        const formattedClient = client ? {
            clientId: client[0],
            ...client[1],
        } : undefined;
        if (requireWs && !formattedClient?.ws) {
            return undefined;
        }
        return formattedClient;
    }
    getClients({ userType } = {}) {
        const clients = [];
        this.clients.forEach((clientData, clientId) => {
            if (userType && clientData.user?.userType !== userType) {
                return;
            }
            clientData.clientId = clientId;
            clients.push(clientData);
        });
        return clients;
    }
    disconnectClient({ clientId }) {
        const clientInfo = this.clients.get(clientId);
        if (clientInfo?.ws) {
            const connectedTime = Date.now() - clientInfo.lastActivity;
            clientInfo.ws.close();
            log('WebSocket client was disconnected due to inactivity', {
                ID: clientId,
                'Time Connected': Time.formatTime({
                    time: connectedTime,
                    format: 's',
                }),
            });
        }
        this.removeClient(clientId);
        log('Client disconnected', { ID: clientId });
        this.printClients();
    }
    printClients() {
        const numClients = this.clients.size;
        const workerId = cluster.isWorker && cluster.worker ? cluster.worker.id : null;
        let logOutput = '\n-------------------------------------------------------\n';
        logOutput += `Connected clients (Count: ${numClients}${workerId ? ` | Worker: ${workerId}` : ''}):\n`;
        logOutput += '-------------------------------------------------------\n';
        if (numClients > 0) {
            this.clients.forEach((client, clientId) => {
                logOutput += `ID: ${clientId} | Username: ${client?.user?.username || '-'} | User Type: ${client?.user?.userType || '-'} | Email: ${client.user?.email ? client.user.email : '-'}\n`;
            });
        }
        else {
            logOutput += 'No clients';
        }
        logOutput += '\n';
        log(logOutput, undefined, {
            muteWorker: true,
        });
    }
    broadcastClientList(type) {
        const clientList = this.getClientList();
        this.clients.forEach(({ ws }) => {
            if (!ws) {
                return;
            }
            ws.send(JSON.stringify({
                type: 'system',
                action: 'clientList',
                clientListType: type,
                data: clientList,
            }));
        });
    }
}
//# sourceMappingURL=websocket-client-manager.js.map