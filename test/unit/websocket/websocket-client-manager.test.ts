import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import WebSocketClientManager from '../../../src/websocket/websocket-client-manager.js';
import * as websocketUtils from '../../../src/websocket/utils.js';

class FakeWebSocket {
  public readyState = WebSocket.OPEN;
  public send = vi.fn();
  public close = vi.fn();
  public removeAllListeners = vi.fn();
}

describe('WebSocketClientManager', () => {
  let manager: WebSocketClientManager;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    manager = new WebSocketClientManager();
    logSpy = vi.spyOn(websocketUtils, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('adds clients and exposes them via helper methods', () => {
    const ws = new FakeWebSocket();
    const broadcastSpy = vi.spyOn(manager, 'broadcastClientList').mockImplementation(() => undefined);
    const printSpy = vi.spyOn(manager, 'printClients').mockImplementation(() => undefined);

    manager.addClient({ clientId: 'client-1', ws, lastActivity: 1000, user: { userId: 1, payload: {} } });

    expect(manager.getClientId({ ws: ws as unknown as WebSocket })).toBe('client-1');
    expect(manager.getClient({ clientId: 'client-1', requireWs: true })?.ws).toBe(ws);
    expect(manager.getClientList()).toHaveLength(1);
    expect(broadcastSpy).toHaveBeenCalledWith('addClient');
    expect(printSpy).toHaveBeenCalled();
  });

  it('updates clients safely and blocks unsafe keys', () => {
    const ws = new FakeWebSocket();
    manager.addClient({ clientId: 'client-1', ws, lastActivity: 1000, user: null });

    const broadcastSpy = vi.spyOn(manager, 'broadcastClientList').mockImplementation(() => undefined);
    const printSpy = vi.spyOn(manager, 'printClients').mockImplementation(() => undefined);

    // Clear previous log spy calls
    logSpy.mockClear();

    manager.updateClient({ clientId: 'client-1', key: 'username', data: 'ada' });
    expect(manager.getClient({ clientId: 'client-1' })?.username).toBe('ada');
    expect(broadcastSpy).toHaveBeenCalledWith('updateClient');
    expect(printSpy).toHaveBeenCalled();

    manager.updateClient({ clientId: 'client-1', key: '__proto__', data: 'bad' });
    manager.updateClient({ clientId: 'client-1', key: 'notAllowed', data: 1 });

    // Now checking log spy instead of console.warn
    expect(logSpy).toHaveBeenCalledWith('Blocked attempt to modify dangerous property', { Property: '__proto__' });
    expect(logSpy).toHaveBeenCalledWith('Blocked attempt to modify unauthorized property', { Property: 'notAllowed' });
  });

  it('removes and disconnects clients', () => {
    const ws = new FakeWebSocket();
    manager.addClient({ clientId: 'client-1', ws, lastActivity: 1000, user: null });

    manager.removeClient('client-1');

    expect(manager.getClient({ clientId: 'client-1' })).toBeUndefined();
    expect(ws.removeAllListeners).toHaveBeenCalled();
  });

  it('finds clients by deep property and filters by user type', () => {
    const ws = new FakeWebSocket();
    manager.addClient({
      clientId: 'client-1',
      ws,
      lastActivity: 1000,
      user: { userId: 1, userType: 'trader', payload: { profile: { email: 'ada@example.com' } } },
    });

    const client = manager.getClientByKey({ key: 'user.payload.profile.email', value: 'ada@example.com' });
    expect(client?.clientId).toBe('client-1');

    const traders = manager.getClients({ userType: 'trader' });
    expect(traders).toHaveLength(1);
    expect(traders[0].clientId).toBe('client-1');
  });

  it('disconnects clients due to inactivity', () => {
    const ws = new FakeWebSocket();
    manager.addClient({ clientId: 'idle', ws, lastActivity: Date.now(), user: null });

    manager.disconnectClient({ clientId: 'idle' });

    expect(ws.close).toHaveBeenCalled();
    expect(manager.getClient({ clientId: 'idle' })).toBeUndefined();
  });

  it('broadcasts client list to connected sockets', () => {
    const openWs = new FakeWebSocket();
    const closedWs = new FakeWebSocket();
    closedWs.readyState = WebSocket.CLOSED;

    manager.addClient({ clientId: 'open', ws: openWs, lastActivity: 1, user: null });
    manager.addClient({ clientId: 'closed', ws: closedWs, lastActivity: 1, user: null });

    manager.broadcastClientList('snapshot');

    expect(openWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'system',
        action: 'clientList',
        clientListType: 'snapshot',
        data: manager.getClientList(),
      }),
    );
    expect(closedWs.send).not.toHaveBeenCalled();
  });

  it('cleans up all clients', () => {
    const ws = new FakeWebSocket();
    manager.addClient({ clientId: 'client-1', ws, lastActivity: 1, user: null });

    manager.cleanup();

    expect(ws.close).toHaveBeenCalled();
    expect(manager.getClientList()).toHaveLength(0);
  });
});
