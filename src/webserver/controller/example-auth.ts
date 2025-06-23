import { FastifyReply, FastifyRequest } from 'fastify';
import WebServerBaseController, { AuthenticatedUser } from './base.js';
import { AuthenticatedRequest, withAuth } from './auth-middleware.js';

/**
 * Example controller demonstrating simplified authentication
 */
export default class ExampleAuthController extends WebServerBaseController {
  
  // Method 1: Using wrapper function approach
  public getUserTickers = withAuth(
    async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
      // User is automatically authenticated and available on request.user
      const { userId } = request.user;
      
      // Your business logic here
      const tickers = [
        { id: 1, symbol: 'AAPL', userId },
        { id: 2, symbol: 'GOOGL', userId }
      ];
      
      return this.sendSuccessResponse(reply, tickers);
    },
    process.env.JWT_SECRET_KEY || 'your-jwt-secret',
    this.authenticateRequest.bind(this)
  );

  // Method 2: Manual authentication (original approach, now simplified)
  public getUserOrders = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = await this.authenticateRequest(request, reply, process.env.JWT_SECRET_KEY || 'your-jwt-secret');
    
    if (!user) {
      // Authentication failed, response already sent
      return;
    }
    
    // Your business logic here
    const orders = [
      { id: 1, userId: user.userId, symbol: 'AAPL', quantity: 10 },
      { id: 2, userId: user.userId, symbol: 'GOOGL', quantity: 5 }
    ];
    
    return this.sendSuccessResponse(reply, orders);
  };

  // Method 3: Creating a simple authenticated wrapper method
  public getUserProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    return this.withAuthentication(request, reply, async (user) => {
      // Your business logic here with authenticated user
      const userProfile = {
        userId: user.userId,
        username: user.payload.username || 'N/A',
        email: user.payload.email || 'N/A'
      };
      
      return this.sendSuccessResponse(reply, userProfile);
    });
  };

  // Helper method for inline authentication
  private async withAuthentication(
    request: FastifyRequest, 
    reply: FastifyReply, 
    handler: (user: AuthenticatedUser) => Promise<void>
  ): Promise<void> {
    const user = await this.authenticateRequest(request, reply, process.env.JWT_SECRET_KEY || 'your-jwt-secret');
    
    if (!user) {
      // Authentication failed, response already sent
      return;
    }
    
    return handler(user);
  }
}
