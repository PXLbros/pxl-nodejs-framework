# API Requester

Thin wrapper around the native `fetch` API for outbound HTTP calls.

## Usage

```ts
import { ApiRequester } from '@scpxl/nodejs-framework/api-requester';

const api = new ApiRequester('https://example.com', { Authorization: 'Bearer token' });

const res = await api.get<User>('/users/1');
if (res) console.log(res.data);
```

Supports `get`, `post`, `put`, `delete`. Each method resolves to `ApiResponse<T> | undefined` (undefined after logging and rethrowing the error).

### Request Config

Pass a second argument with any `RequestInit` options supported by `fetch`. Additional helpers:

- `headers`: per-request header overrides
- `params`: object merged into the URL query string
- `responseType`: `'json' | 'text'` (defaults to `'json'`)

## Error Handling

HTTP errors log status and any parsed response payload before rethrowing a custom error. Wrap calls in try/catch to handle failures gracefully.
