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
  }

  public printRooms() {
    const numRooms = this.rooms.size;

    console.log(`Rooms (${numRooms}):`);

    // Loop through all rooms
    this.rooms.forEach((clientsInRoom, room) => {
      const numClientsInRoom = clientsInRoom.size;

      console.log(`Room (Name: ${room} | Clients: ${numClientsInRoom})`);


      console.log('clientsInRoom', clientsInRoom);

      // Loop through all clients in room
      clientsInRoom.forEach((clientId) => {
        const client = this.clientManager.getClient({ clientId });

        console.log('------- >> client', client);


        console.log(`  Client (ID: ${clientId})`);
      });
    });
  }
}
