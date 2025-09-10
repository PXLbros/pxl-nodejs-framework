# API Requester

Thin wrapper around Axios for outbound HTTP calls.

## Usage

```ts
import { ApiRequester } from '@scpxl/nodejs-framework/api-requester';

const api = new ApiRequester('https://example.com', { Authorization: 'Bearer token' });

const res = await api.get<User>('/users/1');
if (res) console.log(res.data);
```

Supports `get`, `post`, `put`, `delete`. Returns `AxiosResponse<T> | undefined` (undefined on error after logging) and rethrows the error.

## Error Handling

Axios errors are logged with response data if present. Wrap calls in try/catch to handle failures gracefully.
