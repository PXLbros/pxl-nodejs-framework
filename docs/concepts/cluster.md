# Cluster

Optional multi-process clustering using Node.js `cluster` to utilize all CPU cores.

## Enabling

Provide a cluster config when constructing the application (example shape):

```ts
new Application({
  cluster: { workerMode: 'auto' }, // or { workerMode: 'manual', workerCount: 4 }
});
```

The primary process forks workers. Unexpected worker exits are automatically replaced unless a shutdown is in progress.

## Shutdown Flow

On SIGINT/SIGTERM the primary sends a `shutdown` message to each worker. Workers run application `stop()`; once all exit the primary requests final process exit.

## Logging

Worker start and replacement events are logged with id and pid for observability.

## Recommendations

- Use a single HTTP listener per worker; rely on a load balancer at the edge.
- For WebSockets deploy sticky sessions or external pub/sub for scale.
- Keep stateless request handling; store shared state in Redis/DB.
