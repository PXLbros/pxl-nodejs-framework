# PXL Framework - Cluster Mode Example

> ⚠️ **DEPRECATION NOTICE**: Node.js cluster module is considered **legacy** for modern deployments.
>
> **For production, use container orchestration (Kubernetes, Docker Swarm, ECS) instead.**
>
> This example is for:
>
> - Understanding cluster behavior
> - Testing cluster functionality
> - Development/single-server deployments
> - Learning purposes

A comprehensive example demonstrating Node.js cluster functionality for scaling across multiple CPU cores on a single machine.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Example](#running-the-example)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Understanding Cluster Mode](#understanding-cluster-mode)
- [When to Use Cluster](#when-to-use-cluster)
- [Modern Alternatives](#modern-alternatives)
- [Troubleshooting](#troubleshooting)

## ✨ Features

This example demonstrates:

- ✅ **Auto & Manual Worker Modes**: Use all CPUs or specify worker count
- ✅ **Worker Identification**: Track which worker handles each request
- ✅ **Load Distribution**: See how requests are balanced across workers
- ✅ **Shared State via Redis**: Cross-worker data sharing
- ✅ **Local State Isolation**: Worker-specific memory
- ✅ **CPU-Intensive Tasks**: Parallel processing demonstration
- ✅ **Worker Crash Recovery**: Automatic restart on failure
- ✅ **Graceful Shutdown**: Coordinated worker shutdown
- ✅ **Verification Scripts**: Automated cluster testing
- ✅ **Load Testing**: Performance benchmarking

## 📦 Prerequisites

- Node.js >= 22.0.0
- npm or yarn
- Basic understanding of Node.js and HTTP

## 🚀 Installation

```bash
# Navigate to the cluster example directory
cd examples/cluster

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

## 🎮 Running the Example

### Single-Process Mode (No Cluster)

```bash
npm run dev
```

Server runs on `http://localhost:3100` with a single process.

### Cluster Mode - Auto (Use All CPUs)

```bash
npm run cluster:auto
```

Spawns one worker per CPU core (e.g., 8 workers on an 8-core system).

### Cluster Mode - Manual (Specify Worker Count)

```bash
npm run cluster:manual
```

Spawns 4 workers (configurable via `--workers` flag or `.env`).

### Custom Configuration

```bash
# Use 2 workers
npm run dev -- --cluster=manual --workers=2

# Auto mode with environment variable
CLUSTER_ENABLED=true CLUSTER_MODE=auto npm run dev
```

## 🔌 API Endpoints

### Worker Information

#### `GET /cluster/info`

Returns information about the current worker handling the request.

**Response:**

```json
{
  "worker": {
    "id": 2,
    "pid": 12345,
    "isPrimary": false,
    "isWorker": true
  },
  "system": {
    "cpus": 8,
    "platform": "linux",
    "nodeVersion": "v22.0.0"
  },
  "memory": {
    "rss": "45.23 MB",
    "heapUsed": "15.67 MB",
    "heapTotal": "20.00 MB"
  },
  "stats": {
    "requestCount": 5,
    "uptime": "123.45s"
  }
}
```

#### `GET /cluster/workers`

Lists all workers (only works from primary process).

**Response:**

```json
{
  "primary": { "pid": 12340 },
  "workers": [
    { "id": 1, "pid": 12341, "state": "online" },
    { "id": 2, "pid": 12342, "state": "online" }
  ],
  "count": 2
}
```

### CPU-Intensive Tasks

#### `POST /cluster/cpu-intensive`

Simulates CPU-intensive work (Fibonacci calculation).

**Request:**

```json
{
  "n": 35
}
```

**Response:**

```json
{
  "worker": { "id": 3, "pid": 12343 },
  "calculation": {
    "input": 35,
    "result": 9227465,
    "duration": "156ms"
  },
  "message": "Fibonacci(35) = 9227465 calculated in 156ms by worker 3"
}
```

### Shared State (Redis)

#### `POST /cluster/shared-state`

Stores data in Redis (shared across all workers).

**Request:**

```json
{
  "key": "myKey",
  "value": { "message": "Hello", "count": 42 }
}
```

**Response:**

```json
{
  "worker": { "id": 1, "pid": 12341 },
  "action": "stored_in_redis",
  "key": "cluster:myKey",
  "value": { "message": "Hello", "count": 42 },
  "message": "This value is now shared across all workers via Redis"
}
```

#### `GET /cluster/shared-state/:key`

Retrieves shared data from Redis.

**Response:**

```json
{
  "worker": { "id": 2, "pid": 12342 },
  "key": "cluster:myKey",
  "value": { "message": "Hello", "count": 42 },
  "found": true,
  "message": "Retrieved from Redis by worker 2"
}
```

### Local State (Non-Shared)

#### `GET /cluster/local-state`

Demonstrates worker-local state (NOT shared between workers).

**Response:**

```json
{
  "worker": { "id": 1, "pid": 12341 },
  "requestCount": 7,
  "message": "This counter is LOCAL to worker 1 and NOT shared between workers",
  "explanation": "Each worker has its own memory space. Use Redis for shared state."
}
```

### Testing

#### `POST /cluster/crash`

Deliberately crashes the current worker to test auto-restart.

**Response:**

```json
{
  "message": "Worker 3 (PID: 12343) is crashing... it should restart automatically",
  "workerId": 3,
  "pid": 12343
}
```

#### `GET /cluster/memory`

Returns detailed memory usage for the current worker.

## 🧪 Testing

### Automated Verification

```bash
npm run verify
```

Runs comprehensive tests:

- ✓ Server availability check
- ✓ Request distribution across workers
- ✓ Shared state via Redis
- ✓ Local state isolation
- ✓ CPU-intensive task distribution

### Load Testing

```bash
npm run load-test
```

Sends 100 concurrent requests and reports:

- Response time statistics (avg, min, max, p50, p95, p99)
- Requests per second
- Worker distribution
- Load balancing analysis

### Manual Testing

```bash
# Terminal 1: Start cluster with 4 workers
npm run cluster:manual

# Terminal 2: Test worker info
curl http://localhost:3100/cluster/info

# Test CPU-intensive task
curl -X POST http://localhost:3100/cluster/cpu-intensive \
  -H "Content-Type: application/json" \
  -d '{"n": 35}'

# Store shared data
curl -X POST http://localhost:3100/cluster/shared-state \
  -H "Content-Type: application/json" \
  -d '{"key": "test", "value": {"msg": "Hello from worker"}}'

# Retrieve from any worker
curl http://localhost:3100/cluster/shared-state/test

# Crash a worker (test auto-restart)
curl -X POST http://localhost:3100/cluster/crash

# Test graceful shutdown
kill -SIGTERM <primary-pid>
```

## 🧠 Understanding Cluster Mode

### How It Works

1. **Primary Process**: Manages worker processes
2. **Worker Processes**: Handle actual requests
3. **Load Balancing**: OS distributes connections across workers (round-robin)
4. **Process Isolation**: Each worker has separate memory
5. **Shared State**: Use Redis/DB for cross-worker data
6. **Auto-Restart**: Workers automatically restart on crash

### Architecture

```
Primary Process (PID 1000)
├── Worker 1 (PID 1001) - Handles requests
├── Worker 2 (PID 1002) - Handles requests
├── Worker 3 (PID 1003) - Handles requests
└── Worker 4 (PID 1004) - Handles requests
        ↓
All workers share Redis for state
```

### Key Concepts

**✅ Shared (via Redis/DB):**

- User sessions
- Application state
- Cache data
- Configuration

**❌ NOT Shared (per worker):**

- In-memory variables
- Module-level state
- Request counters
- Local caches

## 📊 When to Use Cluster

### ✅ Good Use Cases

- Single-server deployments without orchestration
- Development/testing environments
- Legacy applications migrating to containers
- Simple multi-core utilization

### ❌ NOT Recommended For

- Production with container orchestration (use pod replicas)
- Complex process management requirements
- Applications needing fine-grained control
- Systems with external load balancers

## 🚀 Modern Alternatives

### Recommended: Container Replicas

**Kubernetes Example:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pxl-api
spec:
  replicas: 4 # Scale horizontally
  selector:
    matchLabels:
      app: pxl-api
  template:
    spec:
      containers:
        - name: api
          image: your-image
          ports:
            - containerPort: 3000
```

**Advantages over cluster:**

- ✅ Better orchestration
- ✅ Health checks & auto-scaling
- ✅ Zero-downtime deployments
- ✅ Resource limits per container
- ✅ Industry standard

### For CPU-Intensive Tasks

**Use Worker Threads Instead:**

```typescript
import { Worker } from 'worker_threads';

// For CPU-bound tasks, not I/O scaling
const worker = new Worker('./cpu-task.js');
```

### For Multi-Server Scaling

**Use Load Balancers:**

- NGINX
- HAProxy
- AWS ALB/NLB
- Kubernetes Ingress

## 🔧 Troubleshooting

### Workers Not Starting

**Problem:** Cluster mode enabled but only 1 process runs

**Solution:**

```bash
# Check cluster config in .env
CLUSTER_ENABLED=true
CLUSTER_MODE=auto

# Or use CLI flag
npm run dev -- --cluster=auto
```

### Requests Go to Same Worker

**Problem:** All requests hit the same worker

**Cause:** OS load balancing behavior

**Solution:** Normal with low request volume. Run load test to see distribution.

### Worker Keeps Crashing

**Problem:** Worker exits immediately after start

**Solution:**

1. Check logs for errors
2. Verify Redis connection
3. Check database connectivity
4. Review application code for crashes

### Shared State Not Working

**Problem:** Data not shared between workers

**Solution:**

- Use Redis/database for shared state
- Don't rely on in-memory variables
- Test with `/cluster/shared-state` endpoint

### Graceful Shutdown Timeout

**Problem:** Shutdown takes 30 seconds

**Cause:** Workers not stopping in time

**Solution:**

- Check for long-running requests
- Verify database/Redis cleanup
- Review shutdown hooks

## 📚 Learn More

- [Cluster Documentation](../../docs/concepts/cluster.md)
- [Scaling Guide](../../docs/guides/scaling.md)
- [Deployment Guide](../../docs/guides/deployment.md)
- [Node.js Cluster Module](https://nodejs.org/api/cluster.html)

## ⚖️ License

This example is part of the PXL Framework and follows the same license.

---

**Remember:** For production deployments, prefer container orchestration over Node.js cluster module! 🚀
