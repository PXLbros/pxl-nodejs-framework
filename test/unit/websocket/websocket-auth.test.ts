import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketAuthService } from '../../../src/websocket/websocket-auth.js';
import Jwt from '../../../src/auth/jwt.js';
import type { WebApplicationConfig } from '../../../src/application/web-application.interface.js';

vi.mock('../../../src/auth/jwt.js');

describe('WebSocketAuthService', () => {
  let authService: WebSocketAuthService;
  let mockConfig: WebApplicationConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      name: 'test-app',
      instanceId: 'test-instance',
      rootDirectory: '/test',
      auth: {
        jwtSecretKey: 'test-secret-key',
      },
    } as WebApplicationConfig;

    authService = new WebSocketAuthService(mockConfig);
  });

  describe('validateAuth', () => {
    it('should return null when no token is provided', async () => {
      const result = await authService.validateAuth('ws://localhost:3000');

      expect(result).toBeNull();
    });

    it('should throw error when JWT secret key is not configured', async () => {
      const authServiceNoSecret = new WebSocketAuthService({
        ...mockConfig,
        auth: undefined,
      } as WebApplicationConfig);

      await expect(authServiceNoSecret.validateAuth('ws://localhost:3000?token=test')).rejects.toThrow(
        'JWT secret key not configured',
      );
    });

    it('should validate token and return userId and payload', async () => {
      const mockSecretKey = { type: 'secret' } as any;
      const mockPayload = { sub: '123', email: 'test@example.com' };

      vi.mocked(Jwt.importJwtSecretKey).mockResolvedValue(mockSecretKey);
      vi.mocked(Jwt.jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

      const result = await authService.validateAuth('ws://localhost:3000?token=valid-token');

      expect(result).toEqual({
        userId: 123,
        payload: mockPayload,
      });
      expect(Jwt.importJwtSecretKey).toHaveBeenCalledWith({
        jwtSecretKey: 'test-secret-key',
      });
      expect(Jwt.jwtVerify).toHaveBeenCalledWith('valid-token', mockSecretKey);
    });

    it('should throw error when userId is invalid', async () => {
      const mockSecretKey = { type: 'secret' } as any;
      const mockPayload = { sub: 'invalid', email: 'test@example.com' };

      vi.mocked(Jwt.importJwtSecretKey).mockResolvedValue(mockSecretKey);
      vi.mocked(Jwt.jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

      await expect(authService.validateAuth('ws://localhost:3000?token=invalid-token')).rejects.toThrow(
        'Invalid user ID in token',
      );
    });

    it('should throw error when JWT verification fails', async () => {
      const mockSecretKey = { type: 'secret' } as any;

      vi.mocked(Jwt.importJwtSecretKey).mockResolvedValue(mockSecretKey);
      vi.mocked(Jwt.jwtVerify).mockRejectedValue(new Error('Token expired'));

      await expect(authService.validateAuth('ws://localhost:3000?token=expired-token')).rejects.toThrow(
        'JWT verification failed: Token expired',
      );
    });

    it('should handle malformed URLs gracefully', async () => {
      const result = await authService.validateAuth('ws://localhost:3000?malformed');

      expect(result).toBeNull();
    });

    it('should extract token from query parameters correctly', async () => {
      const mockSecretKey = { type: 'secret' } as any;
      const mockPayload = { sub: '456' };

      vi.mocked(Jwt.importJwtSecretKey).mockResolvedValue(mockSecretKey);
      vi.mocked(Jwt.jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

      const result = await authService.validateAuth('ws://localhost:3000/path?token=test-token&other=param');

      expect(result).toEqual({
        userId: 456,
        payload: mockPayload,
      });
    });
  });
});
