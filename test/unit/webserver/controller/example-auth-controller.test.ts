import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExampleAuthController from '../../../../src/webserver/controller/example-auth.js';
import type { AuthenticatedUser } from '../../../../src/webserver/controller/base.js';

class TestableExampleAuthController extends ExampleAuthController {
  public authenticateRequestMock = vi.fn();

  protected override authenticateRequest(request: any, reply: any) {
    return this.authenticateRequestMock(request, reply);
  }
}

const buildReply = () => {
  const reply: any = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
    request: { id: 'req-1' },
  };
  return reply;
};

const buildController = () =>
  new TestableExampleAuthController({
    applicationConfig: { auth: { jwtSecretKey: 'secret' } } as any,
    webServerOptions: {},
    redisInstance: {} as any,
    queueManager: {} as any,
    eventManager: {} as any,
    databaseInstance: {} as any,
    lifecycleManager: {} as any,
  });

describe('ExampleAuthController', () => {
  let controller: TestableExampleAuthController;
  let sendSuccessSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    controller = buildController();
    sendSuccessSpy = vi.spyOn(controller as any, 'sendSuccessResponse').mockImplementation(() => undefined);
  });

  it('returns tickers for authenticated users via withAuth wrapper', async () => {
    const reply = buildReply();
    const request: any = { headers: { authorization: 'Bearer token' } };
    const user: AuthenticatedUser = { userId: 42, payload: {} };
    controller.authenticateRequestMock.mockResolvedValue(user);

    await controller.getUserTickers(request, reply);

    expect(controller.authenticateRequestMock).toHaveBeenCalledWith(request, reply);
    expect(request.user).toBe(user);
    expect(sendSuccessSpy).toHaveBeenCalledWith({
      reply,
      data: [
        { id: 1, symbol: 'AAPL', userId: 42 },
        { id: 2, symbol: 'GOOGL', userId: 42 },
      ],
    });
  });

  it('returns orders via manual authentication', async () => {
    const reply = buildReply();
    const request: any = { headers: { authorization: 'Bearer token' } };
    const user: AuthenticatedUser = { userId: 99, payload: {} };
    controller.authenticateRequestMock.mockResolvedValue(user);

    await controller.getUserOrders(request, reply);

    expect(sendSuccessSpy).toHaveBeenCalledWith({
      reply,
      data: [
        { id: 1, userId: 99, symbol: 'AAPL', quantity: 10 },
        { id: 2, userId: 99, symbol: 'GOOGL', quantity: 5 },
      ],
    });
  });

  it('short-circuits when manual authentication fails', async () => {
    const reply = buildReply();
    const request: any = {};
    controller.authenticateRequestMock.mockResolvedValue(null);

    await controller.getUserOrders(request, reply);

    expect(sendSuccessSpy).not.toHaveBeenCalled();
  });

  it('builds a user profile via helper method', async () => {
    const reply = buildReply();
    const request: any = {};
    const user: AuthenticatedUser<{ username?: string; email?: string }> = {
      userId: 7,
      payload: { username: 'ada', email: 'ada@example.com' },
    };
    controller.authenticateRequestMock.mockResolvedValue(user);

    await controller.getUserProfile(request, reply);

    expect(sendSuccessSpy).toHaveBeenCalledWith({
      reply,
      data: {
        userId: 7,
        username: 'ada',
        email: 'ada@example.com',
      },
    });
  });

  it('uses fallback values when profile payload is missing', async () => {
    const reply = buildReply();
    const request: any = {};
    const user: AuthenticatedUser = { userId: 5, payload: {} };
    controller.authenticateRequestMock.mockResolvedValue(user);

    await controller.getUserProfile(request, reply);

    expect(sendSuccessSpy).toHaveBeenCalledWith({
      reply,
      data: {
        userId: 5,
        username: 'N/A',
        email: 'N/A',
      },
    });
  });

  it('does not execute handler when helper authentication fails', async () => {
    const reply = buildReply();
    const request: any = {};
    controller.authenticateRequestMock.mockResolvedValue(null);

    await controller.getUserProfile(request, reply);

    expect(sendSuccessSpy).not.toHaveBeenCalled();
  });
});
