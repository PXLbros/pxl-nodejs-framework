# Lifecycle

The lifecycle system lets you hook into initialization, startup, ready state, and shutdown for coordinated resource management.

## Phases

```
CREATED -> INITIALIZING -> STARTING -> RUNNING -> STOPPING -> STOPPED
```

Use these to attach logic at the right moment and ensure clean teardown.

## Hooks

```ts
const remove = app.lifecycle.onInit(async () => {
  /* preload caches */
});
app.lifecycle.onStart(async () => {
  /* connect external services */
});
app.lifecycle.onReady(async () => app.logger.info('Ready'));
app.lifecycle.onBeforeShutdown(async () => {
  /* stop accepting work */
});
app.lifecycle.onShutdown(async () => {
  /* flush metrics */
});
```

Return nothing (errors are collected but don't crash shutdown).

## Tracking Resources

Track disposables and timers so they are auto cleared on shutdown:

```ts
const timer = setInterval(doWork, 1000);
app.lifecycle.trackInterval(timer);

const timeout = setTimeout(expire, 5000);
app.lifecycle.trackTimeout(timeout);

app.lifecycle.trackDisposable({
  dispose: async () => redis.quit(),
});
```

## Graceful Shutdown

Configured timeout (default 10s) ensures shutdown doesn't hang forever. After the timeout remaining hooks are skipped.

Configure:

```ts
new Application({ lifecycle: { gracefulShutdown: { timeoutMs: 15000 } } });
```

## Patterns

- Prefer `onBeforeShutdown` to stop inbound traffic (close HTTP listener / pause queues) then actual cleanup in `onShutdown`.
- Register hooks close to the code that owns the resource.
- Avoid long blocking operations inside shutdown hooks—offload if possible.
