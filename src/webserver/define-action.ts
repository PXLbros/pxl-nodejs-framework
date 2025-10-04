import type { RouteSchemaDefinition } from './webserver.interface.js';
import type { ControllerAction } from './controller/base.interface.js';

/**
 * Define a typed controller action with schema inference.
 * This helper provides TypeScript type inference for controller methods based on Zod schemas.
 *
 * @example
 * const helloSchema = {
 *   body: z.object({ name: z.string() }),
 *   response: { 200: z.object({ message: z.string() }) }
 * } satisfies RouteSchemaDefinition;
 *
 * class MyController extends WebServerBaseController {
 *   hello = defineAction(helloSchema, async (request, reply) => {
 *     // request.body is typed as { name: string }
 *     return reply.send({ message: `Hello ${request.body.name}` });
 *   });
 * }
 */
export function defineAction<Schema extends RouteSchemaDefinition<any, any, any, any, any>>(
  schema: Schema,
  handler: ControllerAction<Schema>,
): ControllerAction<Schema>;

/**
 * Define a controller action without a schema.
 * Useful for actions that don't need validation or type inference.
 */
// eslint-disable-next-line no-redeclare
export function defineAction<Schema extends undefined = undefined>(
  handler: ControllerAction<Schema>,
): ControllerAction<Schema>;

// eslint-disable-next-line no-redeclare
export function defineAction<Schema extends RouteSchemaDefinition<any, any, any, any, any> | undefined>(
  schemaOrHandler: Schema | ControllerAction<Schema>,
  handler?: ControllerAction<Schema>,
): ControllerAction<Schema> {
  if (typeof schemaOrHandler === 'function') {
    // No schema provided, just return the handler
    return schemaOrHandler;
  }

  // Schema provided, return the handler
  // Note: The schema is attached for documentation/IDE purposes only
  // Actual validation happens at the route level
  if (!handler) {
    throw new Error('Handler is required when schema is provided');
  }

  return handler;
}
