import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    custom: vi.fn(),
  },
}));

import { Logger } from '../../../src/logger/index.js';
import { generateClientId, log, parseServerMessage, getRouteKey } from '../../../src/websocket/utils.js';

describe('websocket utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses crypto.randomUUID when available', () => {
    const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('123e4567-e89b-12d3-a456-426614174000');

    const id = generateClientId();

    expect(id).toBe('123e4567e89b12d3a456426614174000');
    uuidSpy.mockRestore();
  });

  it('falls back to randomBytes when randomUUID is unavailable', () => {
    const originalRandomUUID = crypto.randomUUID;
    // @ts-expect-error runtime override for testing fallback path
    crypto.randomUUID = undefined;

    const bytesSpy = vi
      .spyOn(crypto, 'randomBytes')
      .mockReturnValue(Buffer.from('abcdef0123456789abcdef0123456789', 'hex'));

    const id = generateClientId();

    expect(id).toBe('abcdef0123456789abcdef0123456789');

    bytesSpy.mockRestore();
    crypto.randomUUID = originalRandomUUID;
  });

  it('logs websocket messages via Logger.custom', () => {
    log('connected', { clientId: 'abc' }, { muteWorker: true });

    expect(Logger.custom).toHaveBeenCalledWith({
      level: 'webSocket',
      message: 'connected',
      meta: { clientId: 'abc' },
      options: { muteWorker: true },
    });
  });

  it('parses valid websocket server message payloads', () => {
    const message = Buffer.from(JSON.stringify({ type: 'system', action: 'ping', payload: 1 }));

    expect(parseServerMessage(message)).toEqual({ type: 'system', action: 'ping', payload: 1 });
  });

  it('throws when JSON parsing fails', () => {
    expect(() => parseServerMessage('not-json')).toThrowError('Failed to parse JSON');
  });

  it('throws when message payload is null', () => {
    expect(() => parseServerMessage(Buffer.from('null'))).toThrowError('Invalid WebSocket message');
  });

  it('throws when message type is missing', () => {
    const payload = { action: 'ping' };
    expect(() => parseServerMessage(JSON.stringify(payload))).toThrowError('Missing WebSocket message type');
  });

  it('throws when message action is missing', () => {
    const payload = { type: 'system' };
    expect(() => parseServerMessage(JSON.stringify(payload))).toThrowError('Missing WebSocket message action');
  });

  it('builds a consistent route key', () => {
    expect(getRouteKey('client', 'connected')).toBe('client:connected');
  });
});
