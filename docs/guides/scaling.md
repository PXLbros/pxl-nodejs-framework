# Scaling & Clustering

Strategies for scaling horizontally.

## HTTP

Put a reverse proxy / load balancer (NGINX, ALB) in front. Use health endpoint and readiness gating with lifecycle hooks.

## WebSockets

Use sticky sessions or external pub/sub (Redis, NATS) for fan-out beyond a single node.

## Queues

Scale workers independently of web processes—run separate processes with only queue module enabled for heavy workloads.

## Cluster Mode

Enable Node cluster for simple multi-core utilization on a single machine. For container orchestration (Kubernetes) prefer multiple single-process pods instead of in-process clustering.

## Observability

Track per-worker metrics & correlate with process ids. Use structured logs to identify hot spots.
