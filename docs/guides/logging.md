# Logging & Observability

This guide covers structured logging patterns, correlation, redaction, and integrating errors with monitoring.

## Goals

- Consistent, machine-parseable logs
- Fast root cause isolation
- Minimal sensitive leakage
- Link logs ↔ performance spans ↔ error reports

## Basic Usage

```ts
app.logger.info('Started service', { port: 3000 });
app.logger.warn('Cache miss storm', { keyPrefix: 'user:' });
app.logger.error(new Error('Unexpected failure'));
```

## Log Levels (Typical)

| Level | Usage                                   |
| ----- | --------------------------------------- |
| debug | High-volume dev details                 |
| info  | Lifecycle milestones, state changes     |
| warn  | Recoverable anomalies (retry succeeded) |
| error | Unhandled exceptions, failed operations |

Set via config: `logger: { level: 'info', json: true }`.

## Structured Context

Prefer objects over string interpolation:

```ts
app.logger.info('Queue job completed', { jobId, durationMs });
```

## Correlation IDs

Inject a request / job correlation ID into context:

```ts
function withRequestContext(req: any, res: any, next: any) {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.correlationId = correlationId;
  // Example: attach to a request context store if framework exposes one
  next();
}
```

Then log:

```ts
app.logger.info('Fetching user', { correlationId, userId });
```

If you implement a per-request async context (e.g. AsyncLocalStorage), wrap logger to auto-append.

## Redaction

Configure keys to redact:

```ts
logger: {
  redact: ['authorization', 'password', 'token'];
}
```

Ensure secrets, access tokens, session IDs aren't logged.

## Error Handling Patterns

### Operational vs Programmer Errors

| Type        | Example          | Action               |
| ----------- | ---------------- | -------------------- |
| Operational | Redis timeout    | Retry / degrade      |
| Programmer  | Undefined access | Fix code / fail fast |

### Mapping to HTTP Responses

Central Fastify error hook example:

```ts
app.webserver.fastify.setErrorHandler((err, req, reply) => {
  app.logger.error(err, { path: req.url });
  // Map known errors
  if ((err as any).statusCode) return reply.status((err as any).statusCode).send({ error: err.message });
  reply.status(500).send({ error: 'Internal Server Error' });
});
```

### Custom Error Classes

Group domain errors for easier filtering:

```ts
class DomainError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
throw new DomainError('Plan limit exceeded', 'PLAN_LIMIT');
```

Log with code:

```ts
app.logger.warn('Business rule violation', { code: err.code });
```

## Performance + Logs

Couple slow operation logs with performance spans:

```ts
const start = perf.startMeasure('list-users', 'database');
// query
const m = perf.endMeasure(start);
if (m.durationMs > 500) app.logger.warn('Slow query', { ms: m.durationMs, op: m.name });
```

## Queue & Worker Logging

Include job name + id:

```ts
app.queue.process('email:send', async job => {
  app.logger.info('Processing job', { queue: job.name, id: job.id });
});
```

## WebSocket Logging

Log connection lifecycle + error events:

```ts
app.websocket.onConnection(client => {
  app.logger.info('ws connected', { id: client.id });
  client.on('close', () => app.logger.info('ws disconnected', { id: client.id }));
});
```

## Sampling (High Volume)

For very chatty paths (e.g. heartbeat), implement sampling to avoid log flood:

```ts
if (Math.random() < 0.05) app.logger.debug('heartbeat', { id });
```

## Shipping Logs

Send stdout to centralized aggregation (Loki, ELK, Cloud Logging). Avoid blocking transports inside hot paths.

## Alerting Guidelines

| Signal      | Alert Threshold        | Action                        |
| ----------- | ---------------------- | ----------------------------- |
| Error rate  | >1% 5m window          | Investigate recent deploy     |
| Slow op p95 | > SLO                  | Profile and optimize          |
| Queue delay | > (acceptable latency) | Add workers / reduce job time |

## Anti-Patterns

| Pattern                                       | Problem       | Alternative                |
| --------------------------------------------- | ------------- | -------------------------- |
| String concatenation                          | Hard to parse | Structured objects         |
| Logging secrets                               | Security risk | Redact or omit             |
| Massive stack traces at info                  | Noise         | Log at debug or error only |
| Logging every successful request w/ full body | Cost, PII     | Summaries + sampling       |

## Future Enhancements (Planned)

- Error reporter integration (Sentry / custom)
- Automatic correlation ID propagation
- Log-to-span linking helper

---

Next: instrument metrics: [Performance Monitoring](/guides/performance-monitoring) and review [Configuration](/guides/configuration).
