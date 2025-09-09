# Deployment

General guidance—adapt per infrastructure.

## Build

Use your bundler or rely on provided build script:

```bash
npm run build
```

Ship the `dist/` output + production dependencies.

## Environment

Ensure required services (Redis, Postgres) are reachable. Use health endpoints.

## Scaling

- Horizontal: run multiple processes (PM2, containers, Kubernetes)
- WebSocket: consider sticky sessions or external pub/sub
- Queue workers: scale separately from web server

## Observability

Integrate metrics, tracing, and structured logs early.
