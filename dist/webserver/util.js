function getEntityRouteDefinitions({ basePath, entityValidationSchema, }) {
    const routeDefinitions = [];
    const idValidationSchema = {
        type: 'params',
        schema: {
            properties: {
                id: { type: 'integer' },
            },
            required: ['id'],
            type: 'object',
        },
    };
    // Options
    routeDefinitions.push({
        path: `${basePath}/options`,
        method: 'GET',
        action: 'options',
    });
    // Get many
    routeDefinitions.push({
        path: `${basePath}`,
        method: 'GET',
        action: 'getMany',
    });
    // Get one
    routeDefinitions.push({
        path: `${basePath}/:id`,
        method: 'GET',
        action: 'getOne',
        validationSchema: idValidationSchema,
    });
    // Create one
    routeDefinitions.push({
        path: `${basePath}`,
        method: 'POST',
        action: 'createOne',
        validationSchema: entityValidationSchema,
    });
    // Update one
    routeDefinitions.push({
        path: `${basePath}/:id`,
        method: 'PUT',
        action: 'updateOne',
        validationSchema: entityValidationSchema, // TODO: Need to merge with idValidationSchema
    });
    // Delete one
    routeDefinitions.push({
        path: `${basePath}/:id`,
        method: 'DELETE',
        action: 'deleteOne',
        validationSchema: idValidationSchema,
    });
    return routeDefinitions;
}
export default {
    // getEntityRoutes,
    getEntityRouteDefinitions,
};
//# sourceMappingURL=util.js.map