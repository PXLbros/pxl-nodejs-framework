import 'reflect-metadata';
import path from 'path';
import { StatusCodes } from 'http-status-codes';
import BaseController from './base.js';
import { generateFormFields } from '../../database/dynamic-entity-form-decorators.js';
import { Helper } from '../../util/index.js';
export default class EntityController extends BaseController {
    entityManager;
    constructor(props) {
        super(props);
        const { databaseInstance } = props;
        this.entityManager = databaseInstance.getEntityManager();
    }
    getEntity = async () => {
        if (!this.applicationConfig.database || this.applicationConfig.database.enabled !== true) {
            throw new Error(`Database not enabled (Entity: ${this.entityName})`);
        }
        // Define entity module path
        const entityModulePath = path.join(this.applicationConfig.database.entitiesDirectory, `${this.entityName}.${Helper.getScriptFileExtension()}`);
        // Import entity module
        const entityModule = await import(entityModulePath);
        if (!entityModule?.[this.entityName]) {
            throw new Error(`Entity not found (Entity: ${this.entityName})`);
        }
        // Get entity class
        const EntityClass = entityModule[this.entityName];
        return EntityClass;
    };
    getEntityProperties(entityClass) {
        const properties = [];
        const reservedPropertyKeys = ['constructor', 'toJSON'];
        for (const propertyKey of Object.getOwnPropertyNames(entityClass.prototype)) {
            if (propertyKey.startsWith('__')) {
                continue;
            }
            else if (reservedPropertyKeys.includes(propertyKey)) {
                continue;
            }
            properties.push(propertyKey);
        }
        return properties;
    }
    options = async (request, reply) => {
        try {
            const EntityClass = await this.getEntity();
            if (!EntityClass) {
                this.sendErrorResponse(reply, 'Entity not found');
                return;
            }
            const formFields = generateFormFields({ model: EntityClass });
            this.sendSuccessResponse(reply, {
                formFields,
            });
        }
        catch (error) {
            this.sendErrorResponse(reply, error);
        }
    };
    // Pre-getMany hook (can be overridden in the child controller)
    async preGetMany(_) {
        // Default implementation: do nothing
    }
    // Post-getMany hook (can be overridden in the child controller)
    // await this.postGetMany({ entityManager: this.entityManager, request, reply, data });
    async postGetMany(_) {
        // Default implementation: do nothing
    }
    getMany = async (request, reply) => {
        try {
            // Call preGetMany hook
            await this.preGetMany({ entityManager: this.entityManager, request, reply });
            const EntityClass = await this.getEntity();
            if (!EntityClass) {
                this.sendErrorResponse(reply, 'Entity not found');
                return;
            }
            // Pagination parameters
            const page = parseInt(request.query.page) || 1;
            const limit = parseInt(request.query.limit);
            const offset = (page - 1) * (limit > 0 ? limit : 0);
            // Filtering and sorting
            const filters = request.query.filters ? JSON.parse(request.query.filters) : {};
            const sortOrder = request.query['sort-order'] || 'ASC';
            const orderBy = request.query.sort ? { [request.query.sort]: sortOrder } : { id: sortOrder };
            const normalizedQuery = {};
            for (const key in request.query) {
                if (key.endsWith('[]')) {
                    const normalizedKey = key.slice(0, -2);
                    normalizedQuery[normalizedKey] = request.query[key];
                }
                else {
                    normalizedQuery[key] = request.query[key];
                }
            }
            // Build query options
            const options = {
                filters,
                offset,
                orderBy,
            };
            if (limit > 0) {
                options.limit = limit;
            }
            const entityProperties = this.getEntityProperties(EntityClass);
            const reservedQueryKeys = ['page', 'limit', 'filters', 'sort', 'populate', 'search'];
            const searchQuery = request.query.search || '';
            for (const key in normalizedQuery) {
                if (reservedQueryKeys.includes(key)) {
                    continue;
                }
                if (!entityProperties.includes(key)) {
                    const [relation, subProperty] = key.split('.');
                    if (relation && subProperty) {
                        let queryValue = normalizedQuery[key];
                        if (!queryValue)
                            continue;
                        if (typeof queryValue === 'string' && queryValue.includes(',')) {
                            queryValue = queryValue.split(',');
                        }
                        if (Array.isArray(queryValue)) {
                            options.filters[relation] = { [subProperty]: { $in: queryValue } };
                        }
                        else {
                            options.filters[relation] = { [subProperty]: queryValue };
                        }
                    }
                    continue;
                }
                let queryValue = normalizedQuery[key];
                if (!queryValue) {
                    continue;
                }
                if (typeof queryValue === 'string' && queryValue.includes(',')) {
                    queryValue = queryValue.split(',');
                }
                if (Array.isArray(queryValue)) {
                    options.filters[key] = { $in: queryValue };
                }
                else {
                    options.filters[key] = queryValue;
                }
            }
            // Add search filter if a search query is provided
            if (searchQuery) {
                const searchFields = EntityClass.getSearchFields();
                options.filters.$or = searchFields
                    .filter((field) => {
                    const isIntegerField = ['id', 'originId'].includes(field);
                    return !isIntegerField;
                })
                    .map((field) => {
                    return {
                        [field]: { $like: `%${searchQuery}%` },
                    };
                });
            }
            const populate = request.query.populate ? request.query.populate.split(',') : [];
            // Fetch items from the database
            const [items, total] = await this.entityManager.findAndCount(this.entityName, options.filters, {
                limit: options.limit,
                offset: options.offset,
                orderBy: options.orderBy,
                populate,
            });
            const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
            const data = {
                items,
                total,
                page,
                totalPages,
                limit: limit > 0 ? limit : total,
            };
            // Call postGetMany hook
            await this.postGetMany({ entityManager: this.entityManager, request, reply, data });
            reply.send({
                data: data.items,
                total_items: data.total,
                page: data.page,
                total_pages: data.totalPages,
                limit: data.limit,
            });
        }
        catch (error) {
            this.sendErrorResponse(reply, error);
        }
    };
    async preGetOne(_) {
        // Default implementation: do nothing
    }
    async postGetOne(_) {
        // Default implementation: do nothing
    }
    getOne = async (request, reply) => {
        try {
            await this.preGetOne({ entityManager: this.entityManager, request, reply });
            const queryPopulate = request.query.populate || null;
            const populateList = queryPopulate ? queryPopulate.split(',') : [];
            // Ensure populate is typed correctly for MikroORM
            const populate = populateList.map((field) => `${field}.*`);
            const EntityClass = await this.getEntity();
            if (!EntityClass) {
                this.sendErrorResponse(reply, 'Entity not found');
                return;
            }
            const id = request.params.id;
            const item = await this.entityManager.findOne(this.entityName, { id }, { populate });
            if (!item) {
                return this.sendNotFoundResponse(reply, `${EntityClass.singularNameCapitalized} not found`);
            }
            await this.postGetOne({ entityManager: this.entityManager, request, reply, item });
            this.sendSuccessResponse(reply, item);
        }
        catch (error) {
            this.sendErrorResponse(reply, error);
        }
    };
    preCreateOne = ({ request, reply, }) => {
        return { request, reply };
    };
    async postCreateOne(_) { }
    createOne = async (request, reply) => {
        try {
            const EntityClass = await this.getEntity();
            if (!EntityClass) {
                this.sendErrorResponse(reply, 'Entity not found');
                return;
            }
            // Listen for preCreateOne hook
            if (this.preCreateOne) {
                const { request: preCreateOneRequest } = await this.preCreateOne({ request, reply });
                if (preCreateOneRequest) {
                    request = preCreateOneRequest;
                }
            }
            const { error, value } = EntityClass.validate(request.body, true);
            if (error) {
                return this.sendErrorResponse(reply, error.message);
            }
            const item = this.entityManager.create(this.entityName, value);
            await this.entityManager.persistAndFlush(item);
            // Call postCreateOne hook
            await this.postCreateOne({ entityManager: this.entityManager, request, reply, item });
            this.sendSuccessResponse(reply, item, StatusCodes.CREATED);
        }
        catch (error) {
            this.sendErrorResponse(reply, error);
        }
    };
    async postUpdateOne(_) { }
    updateOne = async (request, reply) => {
        try {
            const EntityClass = await this.getEntity();
            if (!EntityClass) {
                this.sendErrorResponse(reply, 'Entity not found');
                return;
            }
            const id = request.params.id;
            const { error, value } = EntityClass.validate(request.body, false);
            if (error) {
                return this.sendErrorResponse(reply, error.message);
            }
            const item = await this.entityManager.findOne(this.entityName, { id });
            if (!item) {
                return this.sendNotFoundResponse(reply, `${EntityClass.singularNameCapitalized} not found`);
            }
            this.entityManager.assign(item, value);
            await this.entityManager.persistAndFlush(item);
            // Call postUpdateOne hook
            await this.postUpdateOne({ entityManager: this.entityManager, request, reply, item });
            this.sendSuccessResponse(reply, item);
        }
        catch (error) {
            this.sendErrorResponse(reply, error);
        }
    };
    deleteOne = async (request, reply) => {
        try {
            const EntityClass = await this.getEntity();
            if (!EntityClass) {
                this.sendErrorResponse(reply, 'Entity not found');
                return;
            }
            const id = request.params.id;
            const item = await this.entityManager.findOne(this.entityName, { id });
            if (!item) {
                return this.sendNotFoundResponse(reply, `${EntityClass.singularNameCapitalized} not found`);
            }
            await this.entityManager.removeAndFlush(item);
            reply.status(StatusCodes.NO_CONTENT).send();
        }
        catch (error) {
            this.sendErrorResponse(reply, error);
        }
    };
}
//# sourceMappingURL=entity.js.map