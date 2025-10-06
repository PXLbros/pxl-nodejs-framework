# Cluster

> ⚠️ **Deprecation Notice**: Node.js cluster module is considered legacy for modern deployments. **Container orchestration (Kubernetes, Docker Swarm, ECS) is the recommended approach** for scaling web applications. Use cluster mode only for simple single-server deployments or development.

Optional multi-process clustering using Node.js `cluster` to utilize all CPU cores on a single machine.

## When to Use Cluster

✅ **Good Use Cases:**

- Development/testing environments
- Simple single-server deployments without orchestration
- Legacy systems migrating to containers

❌ **Not Recommended For:**

- Production deployments with container orchestration (use pod replicas instead)
- Applications requiring complex process management
- Systems where you need fine-grained control over worker lifecycle

## Modern Alternatives

**Recommended: Container Replicas** (Kubernetes, Docker, etc.)

```yaml
# Kubernetes example - preferred approach
replicas: 4 # Scale horizontally with separate processes
```

**For CPU-Intensive Tasks:** Use `worker_threads` for parallel computation within a single process

```ts
import { Worker } from 'worker_threads';
// Use for CPU-bound tasks, not I/O scaling
```

**For Multi-Server Scaling:** Use external load balancers (NGINX, ALB, etc.)

## Enabling Cluster Mode

Provide a cluster config when constructing the application:

```ts
new Application({
  cluster: {
    enabled: true,
    workerMode: 'auto', // Uses all CPU cores
  },
  // or manual worker count:
  cluster: {
    enabled: true,
    workerMode: 'manual',
    workerCount: 4,
  },
});
```

The primary process forks workers. Unexpected worker exits are automatically replaced unless a shutdown is in progress.

## Shutdown Flow

On SIGINT/SIGTERM:

1. Primary process sends `shutdown` message to all workers
2. Each worker calls `stop()` for graceful cleanup
3. Primary waits for all workers to exit (30s timeout)
4. If timeout reached, forces exit with code 1
5. On successful shutdown, exits with code 0

## Logging

Worker lifecycle events are logged:

- Worker start (ID and PID)
- Worker death/restart
- Shutdown progress
- Timeout warnings

## Known Limitations

- **Process Isolation**: Each worker is a separate process with its own memory
- **Higher Memory Usage**: Each worker loads the full application into memory
- **WebSocket Scaling**: Requires sticky sessions or external pub/sub (Redis) for cross-worker communication
- **Shared State**: Cannot share in-memory state between workers (use Redis/database)
- **Deployment Complexity**: Container replicas are simpler to manage

## Best Practices

If you must use cluster mode:

1. **HTTP/WebSocket**: Use a single listener per worker; rely on a load balancer at the edge
2. **WebSocket**: Deploy sticky sessions OR use external pub/sub (Redis) for room broadcasting
3. **State Management**: Keep request handling stateless; store shared state in Redis/DB
4. **Resource Limits**: Set appropriate worker counts to avoid memory exhaustion
5. **Monitoring**: Track per-worker metrics and correlate with process IDs

## Migration Path

**From Cluster → Containers:**

```ts
// Before (cluster mode)
cluster: {
  workerMode: 'auto';
}

// After (container replicas) - remove cluster config entirely
// Scale via deployment configuration instead
```

Update your deployment to scale horizontally with container orchestration.
