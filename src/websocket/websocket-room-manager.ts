import cluster from 'cluster';
import { log } from './utils.js';
import WebSocketClientManager from './websocket-client-manager.js';

export default class WebSocketRoomManager {
  private clientManager: WebSocketClientManager;

  private rooms: Map<string, Set<string>> = new Map();

  constructor({ clientManager }: { clientManager: WebSocketClientManager }) {
    this.clientManager = clientManager;
  }

  public addClientToRoom({ clientId, user, roomName, broadcast }: { clientId: string; user: any; roomName: string; broadcast?: boolean }) {
    // Check if room exists
    if (!this.rooms.has(roomName)) {
      // Create room
      this.rooms.set(roomName, new Set());
    }

    // Get room from room name
    const room = this.rooms.get(roomName);

    if (!room) {
      log('Room not found when adding client', { Name: roomName });

      return;
    }

    // Add client to room
    room.add(clientId);

    // Set room name in client manager
    this.clientManager.updateClient({
      clientId,
      key: 'roomName',
      data: roomName,
    });

    if (broadcast !== false) {
      this.clientManager.broadcastClientList('clientAddedToRoom');
    }

    this.printRooms();

    log('Client joined room', { 'User Type': user?.userType || '-', Room: roomName, ID: clientId, Email: user.email || '-' });
  }

  public removeClientFromRoom({ roomName, clientId, broadcast }: { roomName: string; clientId: string; broadcast?: boolean }) {
    // Get room from room name
    const room = this.rooms.get(roomName);

    if (!room) {
      log('Room not found when removing client', { Name: roomName });

      return;
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

    // Set room name in client manager
    this.clientManager.updateClient({
      clientId,
      key: 'roomName',
      data: null,
    });

    if (broadcast !== false) {
      this.clientManager.broadcastClientList('clientRemovedFromRoom');
    }

    this.printRooms();

    log('Client left room', { Room: roomName, ID: clientId });
  }

  public removeClientFromAllRooms({ clientId }: { clientId: string }) {
    this.rooms.forEach((clientsInRoom, room) => {
      if (!clientsInRoom.has(clientId)) {
        return;
      }

      this.removeClientFromRoom({ roomName: room, clientId, broadcast: false });
    });

    this.clientManager.broadcastClientList('clientRemovedFromAllRooms');

    this.printRooms();
  }


  public isClientInRoom({ clientId, roomName }: { clientId: string; roomName: string }) {
    // Get clients in room
    const clientsInRoom = this.rooms.get(roomName);

    if (!clientsInRoom) {
      return false;
    }

    // Check if client is in room
    return clientsInRoom.has(clientId);
  }

  public printRooms() {
    const numRooms = this.rooms.size;

    let logOutput = '\n-------------------------------------------------------\n';
    logOutput += `Rooms (Count: ${numRooms}):\n`;
    logOutput += '-------------------------------------------------------\n';

    if (numRooms > 0) {
      const workerId = cluster.isWorker && cluster.worker ? cluster.worker.id : null;

      // Loop through all rooms
      let roomNumber = 1;

      this.rooms.forEach((clientsInRoom, room) => {
        const numClientsInRoom = clientsInRoom.size;

        logOutput += `Room ${roomNumber} (Name: ${room} | Clients: ${numClientsInRoom} | Worker: ${workerId}):\n`;
        logOutput += '  Clients:\n';

        // Loop through all clients in room
        clientsInRoom.forEach((clientId) => {
          const client = this.clientManager.getClient({ clientId });

          logOutput += `    Client (ID: ${clientId} | Username: ${client?.user?.username || '-'} | User Type: ${client?.user?.userType || '-'} | Email: ${client?.user?.email ? client.user.email : '-'})\n`;
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
