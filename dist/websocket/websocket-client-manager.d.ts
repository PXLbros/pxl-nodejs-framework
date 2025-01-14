import WebSocket from 'ws';
import { WebSocketClientData } from './websocket-client-manager.interface.js';
export default class WebSocketClientManager {
    private clients;
    addClient({ clientId, ws, lastActivity, }: {
        clientId: string;
        ws: WebSocket | null;
        lastActivity: number;
    }): void;
    getClientId({ ws, }: {
        ws: WebSocket;
    }): string | undefined;
    getClient({ clientId, requireWs, }: {
        clientId: string;
        requireWs?: boolean;
    }): WebSocketClientData | undefined;
    updateClient({ clientId, key, data, broadcastClientList, }: {
        clientId: string;
        key: string;
        data: any;
        broadcastClientList?: boolean;
    }): void;
    removeClient(clientId: string): void;
    getClientList(): {
        [key: string]: any;
        clientId: string;
    }[];
    getClientByKey({ key, value, requireWs, userType, }: {
        key: string;
        value: string;
        requireWs?: boolean;
        userType?: string;
    }): {
        ws: WebSocket | null;
        lastActivity: number;
        roomName?: string;
        clientId: string;
    } | undefined;
    getClients({ userType }?: {
        userType?: string;
    }): WebSocketClientData[];
    disconnectClient({ clientId }: {
        clientId: string;
    }): void;
    printClients(): void;
    broadcastClientList(type: string): void;
}
//# sourceMappingURL=websocket-client-manager.d.ts.map