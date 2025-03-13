import WebSocketClientManager from './websocket-client-manager.js';
export default class WebSocketRoomManager {
    private clientManager;
    private rooms;
    constructor({ clientManager }: {
        clientManager: WebSocketClientManager;
    });
    addClientToRoom({ clientId, user, roomName, broadcast }: {
        clientId: string;
        user: any;
        roomName: string;
        broadcast?: boolean;
    }): void;
    removeClientFromRoom({ roomName, clientId, broadcast }: {
        roomName: string;
        clientId: string;
        broadcast?: boolean;
    }): void;
    removeClientFromAllRooms({ clientId }: {
        clientId: string;
    }): void;
    isClientInRoom({ clientId, roomName }: {
        clientId: string;
        roomName: string;
    }): boolean;
    printRooms(): void;
}
//# sourceMappingURL=websocket-room-manager.d.ts.map