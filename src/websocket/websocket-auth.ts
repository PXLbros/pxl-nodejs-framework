import { URL } from 'url';
import Jwt from '../auth/jwt.js';
import type { WebApplicationConfig } from '../application/web-application.interface.js';

export interface WebSocketAuthResult {
  userId: number;
  payload: Record<string, unknown>;
}

export class WebSocketAuthService {
  constructor(private readonly applicationConfig: WebApplicationConfig) {}

  /**
   * Validates WebSocket authentication token from URL query parameters
   * @param url - The WebSocket connection URL
   * @returns Authentication result with userId and payload, or null if no token provided
   * @throws Error if authentication fails
   */
  async validateAuth(url: string): Promise<WebSocketAuthResult | null> {
    try {
      const parsedUrl = new URL(url, 'ws://localhost');
      const token = parsedUrl.searchParams.get('token');

      if (!token) {
        return null; // No token provided, allow unauthenticated connection
      }

      // Get JWT secret key from application config
      const jwtSecretKey = this.applicationConfig.auth?.jwtSecretKey;

      if (!jwtSecretKey) {
        throw new Error('JWT secret key not configured');
      }

      // Import JWT secret key
      const importedJwtSecretKey = await Jwt.importJwtSecretKey({
        jwtSecretKey,
      });

      // Verify JWT token
      const { payload } = await Jwt.jwtVerify(token, importedJwtSecretKey);

      const userId = parseInt(payload.sub as string);

      if (isNaN(userId)) {
        throw new Error('Invalid user ID in token');
      }

      return { userId, payload };
    } catch (error: any) {
      throw new Error(`JWT verification failed: ${error.message}`);
    }
  }
}
