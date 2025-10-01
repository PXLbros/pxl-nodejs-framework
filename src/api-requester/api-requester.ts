export interface ApiRequestConfig extends Omit<RequestInit, 'method' | 'body' | 'headers'> {
  headers?: Record<string, string | undefined>;
  params?: Record<string, string | number | boolean | null | undefined>;
  responseType?: 'json' | 'text';
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

class ApiRequesterHttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly data: unknown;
  public readonly headers: Record<string, string>;

  constructor(
    message: string,
    options: {
      status: number;
      statusText: string;
      data: unknown;
      headers: Record<string, string>;
    },
  ) {
    super(message);
    this.name = 'ApiRequesterHttpError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.data = options.data;
    this.headers = options.headers;
  }
}

export default class ApiRequester {
  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(baseURL: string, headers: Record<string, string> = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = { ...headers };
  }

  public async get<T>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T> | undefined> {
    return this.request<T>('GET', url, undefined, config);
  }

  public async post<T, R>(url: string, data: T, config?: ApiRequestConfig): Promise<ApiResponse<R> | undefined> {
    return this.request<R>('POST', url, data, config);
  }

  public async put<T, R>(url: string, data: T, config?: ApiRequestConfig): Promise<ApiResponse<R> | undefined> {
    return this.request<R>('PUT', url, data, config);
  }

  public async delete<T>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T> | undefined> {
    return this.request<T>('DELETE', url, undefined, config);
  }

  private async request<T>(
    method: string,
    url: string,
    data?: unknown,
    config?: ApiRequestConfig,
  ): Promise<ApiResponse<T> | undefined> {
    try {
      const { headers: configHeaders, params, responseType = 'json', ...init } = config ?? {};
      const finalUrl = this.buildUrl(url, params);
      const headers = this.mergeHeaders(configHeaders, data);
      const body = this.prepareBody(method, data);

      // fetch is a global in Node.js 18+
      // eslint-disable-next-line no-undef
      const response = await fetch(finalUrl, {
        ...init,
        method,
        headers,
        body,
      });

      if (!response.ok) {
        throw await this.createHttpError(response);
      }

      const parsed = await this.parseResponse<T>(response, responseType);

      return {
        data: parsed,
        status: response.status,
        statusText: response.statusText,
        headers: this.headersToRecord(response.headers),
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  private mergeHeaders(headers?: Record<string, string | undefined>, body?: unknown): Headers {
    const merged = new Headers();

    for (const [key, value] of Object.entries(this.defaultHeaders)) {
      if (value !== undefined) {
        merged.set(key, value);
      }
    }

    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined) {
          merged.set(key, value);
        } else {
          merged.delete(key);
        }
      }
    }

    if (body !== undefined && this.shouldSerializeAsJson(body) && !merged.has('content-type')) {
      merged.set('content-type', 'application/json');
    }

    return merged;
  }

  private prepareBody(method: string, data?: unknown): BodyInit | null | undefined {
    if (method === 'GET' || method === 'HEAD' || data === undefined) {
      return undefined;
    }

    if (typeof data === 'string' || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      return data as BodyInit;
    }

    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      return data;
    }

    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return data;
    }

    if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
      return data;
    }

    if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) {
      return data;
    }

    return JSON.stringify(data);
  }

  private shouldSerializeAsJson(data: unknown): boolean {
    if (data === null) {
      return true;
    }

    if (Array.isArray(data)) {
      return true;
    }

    const primitiveTypes = ['string', 'number', 'boolean', 'bigint'];
    if (primitiveTypes.includes(typeof data)) {
      return false;
    }

    if (typeof data === 'object') {
      return !(
        data instanceof ArrayBuffer ||
        ArrayBuffer.isView(data) ||
        (typeof Blob !== 'undefined' && data instanceof Blob) ||
        (typeof FormData !== 'undefined' && data instanceof FormData) ||
        (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) ||
        (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) ||
        (typeof Buffer !== 'undefined' && Buffer.isBuffer(data))
      );
    }

    return false;
  }

  private headersToRecord(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      // Safe: key comes from Headers iterator, not user input
      // eslint-disable-next-line security/detect-object-injection
      result[key] = value;
    });
    return result;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>): string {
    const absolute = this.isAbsoluteUrl(path) ? path : this.combineWithBase(path);
    if (!params) {
      return absolute;
    }

    const url = new URL(absolute);
    for (const [key, rawValue] of Object.entries(params)) {
      if (rawValue === undefined || rawValue === null) {
        continue;
      }
      url.searchParams.set(key, String(rawValue));
    }
    return url.toString();
  }

  private isAbsoluteUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  private combineWithBase(path: string): string {
    if (!this.baseURL) {
      return path;
    }

    const normalizedBase = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  private async parseResponse<T>(response: Response, responseType: 'json' | 'text'): Promise<T> {
    if (responseType === 'text') {
      return (await response.text()) as T;
    }

    const body = await response.text();
    if (!body) {
      return undefined as T;
    }

    try {
      return JSON.parse(body) as T;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse JSON response: ${reason}`);
    }
  }

  private async createHttpError(response: Response): Promise<ApiRequesterHttpError> {
    const headers = this.headersToRecord(response.headers);
    let data: unknown = undefined;
    let message = `Request failed with status ${response.status}`;

    try {
      const text = await response.text();
      if (text) {
        const contentType = headers['content-type'] ?? '';
        if (contentType.includes('application/json')) {
          data = JSON.parse(text);
          if (data && typeof data === 'object' && 'message' in (data as Record<string, unknown>)) {
            const potentialMessage = (data as Record<string, unknown>).message;
            if (typeof potentialMessage === 'string') {
              message = potentialMessage;
            }
          }
        } else {
          data = text;
          message = text;
        }
      }
    } catch {
      // If parsing fails, use defaults set above
      data = undefined;
      message = `Request failed with status ${response.status}`;
    }

    return new ApiRequesterHttpError(message, {
      status: response.status,
      statusText: response.statusText,
      data,
      headers,
    });
  }

  private handleError(error: unknown): never {
    if (error instanceof ApiRequesterHttpError) {
      console.error('HTTP error:', {
        status: error.status,
        statusText: error.statusText,
        data: error.data,
      });
    } else {
      console.error('Unexpected error:', error);
    }

    throw error;
  }
}
