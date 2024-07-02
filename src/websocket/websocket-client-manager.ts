import WebSocket from 'ws';

export default class WebSocketClientManager {
  private clients: Map<string, { type: string, ws: WebSocket }> = new Map();

  addClient(clientId: string, type: string, ws: WebSocket) {
    this.clients.set(clientId, { type, ws });
    this.broadcastClientList();
  }

  removeClient(clientId: string) {
    this.clients.delete(clientId);
    this.broadcastClientList();
  }

  getClientList() {
    // console.log('getClientList', this.clients.entries());

    return Array.from(this.clients.entries()).map(([id, { type }]) => ({ id, type }));
  }

  broadcastClientList() {
    const clientList = this.getClientList();

    this.clients.forEach(({ ws }) => {
      ws.send(JSON.stringify({ type: 'system', action: 'clientList', data: clientList }));
    });
  }
}

