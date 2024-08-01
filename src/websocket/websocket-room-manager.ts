import { log } from './utils.js';
import WebSocketClientManager from './websocket-client-manager.js';

export default class WebSocketRoomManager {
  private clientManager: WebSocketClientManager;

  private rooms: Map<string, Set<string>> = new Map();

  constructor({ clientManager }: { clientManager: WebSocketClientManager }) {
    this.clientManager = clientManager;
  }

  public addClientToRoom({ clientId, user, roomName }: { clientId: string; user: any; roomName: string; }) {
    // Check if room exists
    if (!this.rooms.has(roomName)) {
      // Create room
      this.rooms.set(roomName, new Set());
    }

    // Get room from room name
    const room = this.rooms.get(roomName);

    if (!room) {
      throw new Error(`Room not found (Name: ${roomName})`);
    }

    // Add client to room
    room.add(clientId);

    this.printRooms();
  }

  public removeClientFromRoom({ roomName, clientId }: { roomName: string; clientId: string }) {
    // Get room from room name
    const room = this.rooms.get(roomName);

    if (!room) {
      throw new Error(`Room not found (Name: ${roomName})`);
    }

    // Get clients in room
    const clientsInRoom = this.rooms.get(roomName);

    if (!clientsInRoom) {
      return;
    }

    // Remove client from room list
    clientsInRoom.delete(clientId);

    // Check if there are no clients in the room
    if (clientsInRoom.size === 0) {
      // Delete room
      this.rooms.delete(roomName);
    }

    this.printRooms();
  }

  public removeClientFromAllRooms({ clientId }: { clientId: string }) {
    this.rooms.forEach((clientsInRoom, room) => {
      if (!clientsInRoom.has(clientId)) {
        return;
      }

      this.removeClientFromRoom({ roomName: room, clientId });
    });

    this.printRooms();
  }

  public printRooms() {
    let logOutput = '';

    const numRooms = this.rooms.size;

    logOutput = `\nRooms (Count: ${numRooms}):\n`;

    if (numRooms > 0) {
      // Loop through all rooms
      let roomNumber = 1;

      this.rooms.forEach((clientsInRoom, room) => {
        const numClientsInRoom = clientsInRoom.size;

        logOutput += `Room ${roomNumber} (Name: ${room} | Clients: ${numClientsInRoom}):\n`;
        logOutput += '  Clients:\n';

        // Loop through all clients in room
        clientsInRoom.forEach((clientId) => {
          const client = this.clientManager.getClient({ clientId });

          logOutput += `    Client (ID: ${clientId} | Email: ${client?.user ? client.user.email : ''})\n`;
        });

        roomNumber++;
      });
    } else {
      logOutput += 'No rooms\n';
    }

    logOutput += '\n';

    log(logOutput);
  }
}
