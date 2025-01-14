import { Logger } from '../logger/index.js';
export function generateClientId() {
    return Math.random().toString(36).substr(2, 9);
}
export function log(message, meta, options) {
    Logger.custom('webSocket', message, meta, options);
}
export function parseServerMessage(message) {
    let parsedMessage;
    try {
        parsedMessage = JSON.parse(message.toString());
    }
    catch (error) {
        throw new Error('Failed to parse JSON');
    }
    if (!parsedMessage) {
        throw new Error('Invalid WebSocket message');
    }
    else if (!parsedMessage.type) {
        throw new Error('Missing WebSocket message type');
    }
    else if (!parsedMessage.action) {
        throw new Error('Missing WebSocket message action');
    }
    return parsedMessage;
}
export function getRouteKey(type, action) {
    return `${type}:${action}`;
}
//# sourceMappingURL=utils.js.map