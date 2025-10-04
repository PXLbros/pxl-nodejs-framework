import { describe, it, expect, vi } from 'vitest';
import {
  withAuth,
  requiresAuth,
  type AuthenticatedUser,
} from '../../../../src/webserver/controller/auth-middleware.js';

describe('auth middleware', () => {
  describe('withAuth', () => {
    it('attaches the authenticated user and invokes the handler', async () => {
      const user = { id: 'user-1' } as AuthenticatedUser;
      const handler = vi.fn().mockResolvedValue('ok');
      const authenticateRequest = vi.fn().mockResolvedValue(user);
      const request: any = { headers: {} };
      const reply: any = { status: vi.fn() };

      const wrapped = withAuth(handler, authenticateRequest);
      const result = await wrapped(request, reply);

      expect(result).toBe('ok');
      expect(authenticateRequest).toHaveBeenCalledWith(request, reply);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ user }), reply);
      expect(request.user).toBe(user);
    });

    it('returns early when authentication fails', async () => {
      const handler = vi.fn();
      const authenticateRequest = vi.fn().mockResolvedValue(null);
      const request: any = {};
      const reply: any = {};

      const wrapped = withAuth(handler, authenticateRequest);
      const result = await wrapped(request, reply);

      expect(result).toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
      expect(request.user).toBeUndefined();
    });
  });

  describe('requiresAuth decorator', () => {
    it('wraps controller methods with authentication logic', async () => {
      const user = { id: 'decorated' } as AuthenticatedUser;
      const originalMethod = vi.fn().mockResolvedValue('ok');
      const target = {
        authenticateRequest: vi.fn().mockResolvedValue(user),
      };
      const descriptor = { value: originalMethod } as PropertyDescriptor;

      const decoratedDescriptor = requiresAuth()(target, 'secureMethod', descriptor);

      const request: any = {};
      const reply: any = {};
      const result = await decoratedDescriptor.value.call(target, request, reply);

      expect(result).toBe('ok');
      expect(target.authenticateRequest).toHaveBeenCalledWith(request, reply);
      expect(originalMethod).toHaveBeenCalledWith(request, reply);
      expect(request.user).toBe(user);
    });

    it('does not invoke the original method when authentication fails', async () => {
      const originalMethod = vi.fn();
      const target = {
        authenticateRequest: vi.fn().mockResolvedValue(null),
      };
      const descriptor = { value: originalMethod } as PropertyDescriptor;

      const decoratedDescriptor = requiresAuth()(target, 'secureMethod', descriptor);

      const request: any = {};
      const reply: any = {};
      const result = await decoratedDescriptor.value.call(target, request, reply);

      expect(result).toBeUndefined();
      expect(originalMethod).not.toHaveBeenCalled();
      expect(request.user).toBeUndefined();
    });
  });
});
