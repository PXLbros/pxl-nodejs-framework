import { describe, it, expect, vi, beforeEach } from 'vitest';
import Jwt from '../../../src/auth/jwt.js';

// Mock jose library
vi.mock('jose', () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock-jwt-token'),
  })),
  importJWK: vi.fn().mockResolvedValue('mock-secret-key'),
  jwtVerify: vi.fn().mockResolvedValue({
    payload: { sub: '123', exp: Date.now() + 3600000 },
  }),
}));

describe('JWT utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importJwtSecretKey', () => {
    it('should import JWT secret key', async () => {
      const result = await Jwt.importJwtSecretKey({
        jwtSecretKey: 'test-secret',
      });

      expect(result).toBe('mock-secret-key');
    });
  });

  describe('generateJwtToken', () => {
    it('should generate a JWT token', async () => {
      const result = await Jwt.generateJwtToken({
        secretKey: 'mock-secret-key',
        payload: { sub: '123' },
        expirationTime: 24,
      });

      expect(result).toBe('mock-jwt-token');
    });

    it('should generate a JWT token with custom expiration', async () => {
      const result = await Jwt.generateJwtToken({
        secretKey: 'mock-secret-key',
        payload: { sub: '123', role: 'user' },
        expirationTime: 48,
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('generateJwtTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const mockEntityManager = {
        flush: vi.fn().mockResolvedValue(undefined),
      };

      const result = await Jwt.generateJwtTokens({
        entityManager: mockEntityManager,
        payload: { sub: '123' },
        jwtSecretKey: 'test-secret',
      });

      expect(result).toEqual({
        type: 'Bearer',
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-jwt-token',
        expiresAt: expect.any(Date),
      });
      expect(mockEntityManager.flush).toHaveBeenCalled();
    });

    it('should generate tokens with custom payload', async () => {
      const mockEntityManager = {
        flush: vi.fn().mockResolvedValue(undefined),
      };

      const payload = {
        sub: '456',
        email: 'test@example.com',
        role: 'admin',
      };

      const result = await Jwt.generateJwtTokens({
        entityManager: mockEntityManager,
        payload,
        jwtSecretKey: 'test-secret',
      });

      expect(result.type).toBe('Bearer');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should set expiration date 24 hours from now', async () => {
      const mockEntityManager = {
        flush: vi.fn().mockResolvedValue(undefined),
      };

      const beforeTime = Date.now();
      const result = await Jwt.generateJwtTokens({
        entityManager: mockEntityManager,
        payload: { sub: '123' },
        jwtSecretKey: 'test-secret',
      });
      const afterTime = Date.now();

      const expirationTime = result.expiresAt.getTime();
      const expectedMinTime = beforeTime + 24 * 60 * 60 * 1000;
      const expectedMaxTime = afterTime + 24 * 60 * 60 * 1000;

      expect(expirationTime).toBeGreaterThanOrEqual(expectedMinTime);
      expect(expirationTime).toBeLessThanOrEqual(expectedMaxTime);
    });
  });

  describe('jwtVerify', () => {
    it('should verify JWT token', async () => {
      const result = await Jwt.jwtVerify('mock-token', 'mock-secret-key');

      expect(result.payload).toBeDefined();
      expect(result.payload.sub).toBe('123');
    });
  });
});
