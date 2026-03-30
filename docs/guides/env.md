# Environment Variables

Node.js 22+ has built-in `.env` file support -- no external packages needed.

```ts
// Load .env at the top of your entry file
process.loadEnvFile();

// Or use the CLI flag:
// node --env-file=.env src/index.ts
```

## Common Vars

```
PORT=3000
LOG_LEVEL=info
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
DATABASE_URL=postgres://...
```

Map them into your Application config before construction.
