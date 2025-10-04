# Deployment

Guidance for packaging, running, and scaling a PXL application in production.

## 1. Build Artifacts

```bash
npm install --production=false
npm run build
```

Artifacts:

- `dist/` (compiled JS + types)
- `package.json` (pruned dependencies if using a copy/install step)
- Any static assets required at runtime

## 2. Docker Example

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
USER node
EXPOSE 3000
CMD ["node", "dist/app.js"]
```

Optional: Add a separate image (or command) that runs queue workers: `CMD ["node", "dist/queue-worker.js"]`.

## 3. Process Model Options

| Scenario                        | Approach                                       |
| ------------------------------- | ---------------------------------------------- |
| HTTP + WebSocket + light queues | Single process                                 |
| Heavy queue workload            | Separate worker deployment                     |
| High CPU bound tasks            | External worker pool / job offloading          |
| Multi-core utilization          | Container replicas (preferred) or Node cluster |

## 4. Health Checks

Implement a simple endpoint early:

```ts
app.webserver.route({ method: 'GET', url: '/healthz', handler: () => ({ status: 'ok' }) });
```

Add deeper readiness (DB / Redis):

```ts
app.webserver.route({
  method: 'GET',
  url: '/ready',
  handler: async () => ({
    redis: app.redis?.client.status === 'ready',
    db: !!app.database?.orm?.isConnected?.(),
  }),
});
```

## 5. Environment Strategy

| Env        | Characteristics             | Notes                                  |
| ---------- | --------------------------- | -------------------------------------- |
| dev        | Fast feedback, verbose logs | May use in-memory / ephemeral services |
| staging    | Production-like             | Run migrations + feature toggles       |
| production | Hardened config             | Lower log verbosity, metrics export    |

Promote the same build artifact across environments when possible.

## 6. Scaling Patterns

- HTTP / WebSocket: scale horizontally behind load balancer (sticky sessions for native in-memory WS state, or add external pub/sub for room broadcasting).
- Queue workers: scale independently focusing on concurrency setting; monitor queue latency.
- Database: ensure connection pool sizing matches max concurrency.
- Cache: monitor hit ratio; adjust TTLs.

## 7. Zero-Downtime Rollouts

1. Deploy new replica(s) alongside old.
2. Wait for readiness probes to pass.
3. Drain old pods / processes (stop accepting new connections).
4. Terminate after ongoing requests finish (graceful shutdown handles timers/workers).

## 8. Observability / Telemetry

- Logs: ensure structured (JSON) & centralized (e.g. Loki, ELK).
- Metrics: export performance summary periodically (`perf.generateReport()`).
- Tracing (future): integrate OpenTelemetry around key spans.
- Alerts: set SLO-aligned thresholds (p95 latency, queue delay, error rate).

## 9. Migrations & Data Changes

Run DB migrations before starting the main application process:

```bash
node dist/scripts/run-migrations.js && node dist/app.js
```

Keep seeding logic idempotent if reused across environments.

## 10. Security Considerations

- Set `NODE_ENV=production`.
- Limit exposed ports (only HTTP / WS externally).
- Use network policies / security groups to restrict Redis & Postgres access.
- Redact sensitive fields via logger `redact` option.
- Rotate JWT signing keys on a schedule (keep previous for grace period).

## 11. Config Injection

Avoid baking secrets into images; rely on environment variables / secret managers. Validate early and fail fast.

## 12. Resource Limits

If using containers: set CPU & memory requests/limits, and monitor headroom to tune concurrency.

## 13. Example Kubernetes Snippet

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
	name: pxl-api
spec:
	replicas: 3
	strategy:
		rollingUpdate:
			maxSurge: 1
			maxUnavailable: 0
	selector:
		matchLabels: { app: pxl-api }
	template:
		metadata:
			labels: { app: pxl-api }
		spec:
			containers:
				- name: api
					image: ghcr.io/your-org/pxl-api:latest
					ports:
						- containerPort: 3000
					env:
						- name: PORT
							value: "3000"
						- name: LOG_LEVEL
							value: info
					readinessProbe:
						httpGet: { path: /healthz, port: 3000 }
						initialDelaySeconds: 5
						periodSeconds: 10
					resources:
						requests: { cpu: "250m", memory: "256Mi" }
						limits: { cpu: "500m", memory: "512Mi" }
```

## 14. Disaster Recovery

- Backup database snapshots regularly.
- Consider exporting critical cache keys if warm-up is costly.
- Keep infrastructure-as-code versioned (Terraform / Helm / etc.).

## 15. Common Pitfalls

| Symptom                  | Root Cause           | Solution                                 |
| ------------------------ | -------------------- | ---------------------------------------- |
| Memory creep             | Unstopped intervals  | Use lifecycle tracking (`trackInterval`) |
| Socket disconnect storms | No sticky sessions   | Add LB affinity or external pub/sub      |
| High queue latency       | Insufficient workers | Scale worker replica / concurrency       |
| Slow shutdown            | Long-running DB ops  | Shorten graceful timeout & abort work    |

---

Next: instrument & tune performance: [Performance Monitoring](/guides/performance-monitoring) and [Scaling](/guides/scaling).
