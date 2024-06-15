import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { __dirname as baseDir };

export * from './application/index.js';
export * from './auth/index.js';
export * from './command/index.js';
export * from './database/index.js';
export * from './redis/index.js';
export * from './logger/index.js';
export * from './queue/index.js';
export * from './services/index.js';
export * from './util/index.js';
export * from './webserver/index.js';
export * from './websocket/index.js';
