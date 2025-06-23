// Example usage of the simplified authentication in a real controller

import { FastifyRequest, FastifyReply } from 'fastify';
import { WebServerBaseController, AuthenticatedRequest, withAuth, AuthenticatedUser } from '../index.js';

export default class UserTickerController extends WebServerBaseController {
  
  // Example 1: Using the withAuth wrapper (cleanest approach)
  public getUserTickers = withAuth(
    async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
      const { userId } = request.user;
      
      // Fetch user's tickers from database
      const tickers = await this.databaseInstance.getEntityManager().find('UserTicker', {
        userId: userId
      });
      
      return this.sendSuccessResponse(reply, tickers);
    },
    process.env.JWT_SECRET_KEY!,
    this.authenticateRequest.bind(this)
  );

  // Example 2: Manual authentication (more control)
  public createUserTicker = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = await this.authenticateRequest(request, reply, process.env.JWT_SECRET_KEY!);
    
    if (!user) {
      // Authentication failed, response already sent
      return;
    }

    const { symbol } = request.body as { symbol: string };
    
    if (!symbol) {
      return this.sendErrorResponse(reply, 'Symbol is required', 400);
    }

    // Create new ticker for user
    const em = this.databaseInstance.getEntityManager();
    const ticker = em.create('UserTicker', {
      userId: user.userId,
      symbol: symbol.toUpperCase(),
      createdAt: new Date()
    });
    
    await em.persistAndFlush(ticker);
    
    return this.sendSuccessResponse(reply, ticker);
  };

  // Example 3: Helper method approach
  public deleteUserTicker = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    return this.withAuthentication(request, reply, async (user) => {
      const { tickerId } = request.params as { tickerId: string };
      
      const em = this.databaseInstance.getEntityManager();
      const ticker = await em.findOne('UserTicker', {
        id: parseInt(tickerId),
        userId: user.userId // Ensure user can only delete their own tickers
      });

      if (!ticker) {
        return this.sendNotFoundResponse(reply, 'Ticker not found');
      }

      await em.removeAndFlush(ticker);
      
      return this.sendSuccessResponse(reply, { deleted: true });
    });
  };

  // Helper method for inline authentication
  private async withAuthentication(
    request: FastifyRequest, 
    reply: FastifyReply, 
    handler: (user: AuthenticatedUser) => Promise<void>
  ): Promise<void> {
    const user = await this.authenticateRequest(request, reply, process.env.JWT_SECRET_KEY!);
    
    if (!user) {
      return;
    }
    
    return handler(user);
  }
}
