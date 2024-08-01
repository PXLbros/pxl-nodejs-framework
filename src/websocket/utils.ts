import WebSocket from 'ws';
import { Logger } from '../logger/index.js';

export function generateClientId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function log(message: string, meta?: Record<string, unknown>): void {
  Logger.custom('webSocket', message, meta);
}

export function parseServerMessage(message: WebSocket.Data): Record<string, unknown> {
  let parsedMessage;

  try {
    parsedMessage = JSON.parse(message.toString());
  } catch (error) {
    throw new Error('Failed to parse JSON');
  }

  if (!parsedMessage) {
    throw new Error('Invalid WebSocket message');
  } else if (!parsedMessage.type) {
    throw new Error('Missing WebSocket message type');
  } else  if (!parsedMessage.action) {
    throw new Error('Missing WebSocket message action');
  }

  return parsedMessage;
}

export function getRouteKey(type: string, action: string): string {
  return `${type}:${action}`;
}

export function getRoomName({ clientSlug, projectSlug }: { clientSlug?: string; projectSlug?: string }): string{
  if (clientSlug && projectSlug) {
    return `client:${clientSlug}|project:${projectSlug}`;
  } else if (clientSlug) {
    return `client:${clientSlug}`;
  } else if (projectSlug) {
    return `project:${projectSlug}`;
  } else {
    return 'default';
  }
};

