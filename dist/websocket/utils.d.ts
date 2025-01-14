import WebSocket from 'ws';
export interface LogOptions {
    muteWorker?: boolean;
}
export declare function generateClientId(): string;
export declare function log(message: string, meta?: Record<string, unknown>, options?: LogOptions): void;
export declare function parseServerMessage(message: WebSocket.Data): Record<string, unknown>;
export declare function getRouteKey(type: string, action: string): string;
//# sourceMappingURL=utils.d.ts.map