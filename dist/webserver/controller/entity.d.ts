import 'reflect-metadata';
import { EntityManager } from '@mikro-orm/core';
import { FastifyReply, FastifyRequest } from 'fastify';
import BaseController from './base.js';
import { DynamicEntity } from '../../database/dynamic-entity.js';
import { WebServerBaseControllerConstructorParams } from './base.interface.js';
export default abstract class EntityController extends BaseController {
    protected abstract entityName: string;
    protected entityManager: EntityManager;
    constructor(props: WebServerBaseControllerConstructorParams);
    protected getEntity: () => Promise<typeof DynamicEntity | undefined>;
    private getEntityProperties;
    options: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    protected preGetMany(_: {
        entityManager: EntityManager;
        request: FastifyRequest;
        reply: FastifyReply;
    }): Promise<void>;
    protected postGetMany(_: {
        entityManager: EntityManager;
        request: FastifyRequest;
        reply: FastifyReply;
        data: {
            items: any[];
            total: number;
            page: number;
            totalPages: number;
            limit: number;
        };
    }): Promise<void>;
    getMany: (request: FastifyRequest<{
        Querystring: {
            page: string;
            limit: string;
            filters: string;
            sort: string;
            "sort-order": string;
            search: string;
            [key: string]: any;
        };
    }>, reply: FastifyReply) => Promise<void>;
    protected preGetOne(_: {
        entityManager: EntityManager;
        request: FastifyRequest;
        reply: FastifyReply;
    }): Promise<void>;
    protected postGetOne(_: {
        entityManager: EntityManager;
        request: FastifyRequest;
        reply: FastifyReply;
        item: any;
    }): Promise<void>;
    getOne: (request: FastifyRequest<{
        Params: {
            id: number;
        };
        Querystring: {
            populate: string;
        };
    }>, reply: FastifyReply) => Promise<void>;
    protected preCreateOne: ({ request, reply, }: {
        request: FastifyRequest;
        reply: FastifyReply;
    }) => {
        request: FastifyRequest;
        reply: FastifyReply;
    };
    protected postCreateOne(_: {
        entityManager: EntityManager;
        request: FastifyRequest;
        reply: FastifyReply;
        item: any;
    }): Promise<void>;
    createOne: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    protected postUpdateOne(_: {
        entityManager: EntityManager;
        request: FastifyRequest;
        reply: FastifyReply;
        item: any;
    }): Promise<void>;
    updateOne: (request: FastifyRequest<{
        Params: {
            id: number;
        };
    }>, reply: FastifyReply) => Promise<void>;
    deleteOne: (request: FastifyRequest<{
        Params: {
            id: number;
        };
    }>, reply: FastifyReply) => Promise<void>;
}
//# sourceMappingURL=entity.d.ts.map