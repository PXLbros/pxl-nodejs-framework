import { FastifyReply, FastifyRequest } from 'fastify';
import BaseController from './base.js';
export default class extends BaseController {
    health: (_: FastifyRequest, reply: FastifyReply) => Promise<void>;
    private checkDatabaseConnection;
    private checkRedisConnection;
}
//# sourceMappingURL=health.d.ts.map