import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticatedUser } from './base.js';

export { AuthenticatedUser } from './base.js';

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

export type AuthenticatedRouteHandler = (request: AuthenticatedRequest, reply: FastifyReply) => Promise<void>;
export type RouteHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

/**
 * Higher-order function that wraps a route handler with authentication
 * @param handler The route handler that requires authentication
 * @param jwtSecretKey The JWT secret key for token verification
 * @param authenticateRequest The authentication method from the controller
 * @returns A new route handler with authentication built-in
 */
export function withAuth(
  handler: AuthenticatedRouteHandler,
  jwtSecretKey: string,
  authenticateRequest: (request: FastifyRequest, reply: FastifyReply, jwtSecretKey: string) => Promise<AuthenticatedUser | null>
): RouteHandler {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = await authenticateRequest(request, reply, jwtSecretKey);
    
    if (!user) {
      // Authentication failed, response already sent by authenticateRequest
      return;
    }

    // Add user to request object
    (request as AuthenticatedRequest).user = user;

    // Call the original handler with the authenticated request
    return handler(request as AuthenticatedRequest, reply);
  };
}

/**
 * Method decorator for class-based controllers
 * Usage: @requiresAuth('JWT_SECRET_KEY')
 */
export function requiresAuth(jwtSecretKey: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, request: FastifyRequest, reply: FastifyReply) {
      const user = await this.authenticateRequest(request, reply, jwtSecretKey);
      
      if (!user) {
        // Authentication failed, response already sent by authenticateRequest
        return;
      }

      // Add user to request object
      (request as AuthenticatedRequest).user = user;

      // Call the original method with the authenticated request
      return originalMethod.call(this, request, reply);
    };

    return descriptor;
  };
}
