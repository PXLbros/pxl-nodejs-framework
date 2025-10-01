import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import ApiRequester from '../../../src/api-requester/api-requester.js';

describe('ApiRequester', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      Reflect.deleteProperty(globalThis as Record<string, unknown>, 'fetch');
    }
    vi.restoreAllMocks();
  });

  it('performs GET requests with base URL, query params, and merged headers', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    fetchMock.mockResolvedValue(mockResponse);

    const requester = new ApiRequester('https://api.example.com', {
      Authorization: 'Bearer token',
    });

    const result = await requester.get<{ ok: boolean }>('/users', {
      params: { page: 1, active: true },
      headers: { 'X-Request-Id': 'req-123' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example.com/users?page=1&active=true');
    expect(init?.method).toBe('GET');

    const headers = init?.headers as Headers | undefined;
    expect(headers?.get('authorization')).toBe('Bearer token');
    expect(headers?.get('x-request-id')).toBe('req-123');

    expect(result?.data.ok).toBe(true);
    expect(result?.status).toBe(200);
    expect(result?.headers['content-type']).toBe('application/json');
  });

  it('serializes JSON bodies for POST and sets content-type automatically', async () => {
    const mockResponse = new Response(JSON.stringify({ created: true }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
    fetchMock.mockResolvedValue(mockResponse);

    const requester = new ApiRequester('https://api.example.com');

    const payload = { name: 'Jane Doe' };
    const result = await requester.post<typeof payload, { created: boolean }>('users', payload);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(payload));

    const headers = init?.headers as Headers | undefined;
    expect(headers?.get('content-type')).toBe('application/json');

    expect(result?.data.created).toBe(true);
    expect(result?.status).toBe(201);
  });

  it('returns raw text when responseType is text', async () => {
    const mockResponse = new Response('plain-text-response', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
    fetchMock.mockResolvedValue(mockResponse);

    const requester = new ApiRequester('https://api.example.com');

    const result = await requester.get<string>('info', { responseType: 'text' });

    expect(result?.data).toBe('plain-text-response');
  });

  it('throws ApiRequesterHttpError with parsed payload for non-ok responses', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockResponse = new Response(JSON.stringify({ message: 'Not found' }), {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/json' },
    });
    fetchMock.mockResolvedValue(mockResponse);

    const requester = new ApiRequester('https://api.example.com');

    await expect(requester.get('missing-resource')).rejects.toMatchObject({
      name: 'ApiRequesterHttpError',
      status: 404,
      statusText: 'Not Found',
      data: { message: 'Not found' },
    });

    expect(consoleSpy).toHaveBeenCalledWith('HTTP error:', {
      status: 404,
      statusText: 'Not Found',
      data: { message: 'Not found' },
    });
  });

  it('propagates JSON parse failures with descriptive error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockResponse = new Response('not-json', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    fetchMock.mockResolvedValue(mockResponse);

    const requester = new ApiRequester('https://api.example.com');

    await expect(requester.get('bad-json')).rejects.toThrow(/Failed to parse JSON response/);

    expect(consoleSpy).toHaveBeenCalledWith('Unexpected error:', expect.any(Error));
  });
});
