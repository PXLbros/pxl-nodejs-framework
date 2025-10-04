# Configuration

Pass a configuration object to the `Application` constructor. Provide only modules you need.

## Example

```ts
new Application({
  webserver: { port: 3000 },
  websocket: { enabled: true, path: '/ws' },
  queue: { enabled: true },
  database: {
    /* MikroORM opts */
  },
  redis: { host: '127.0.0.1', port: 6379 },
  logger: { level: 'info' },
});
```

## Web Server Options

- `controllersDirectory` – Directory containing controller classes referenced by routes.
- `routesDirectory` – Optional directory for auto-loaded route definition files. Files may export a single route, an array of routes, or `{ routes: [...] }`.

## Optional Modules

Leaving a section out means it's skipped.
