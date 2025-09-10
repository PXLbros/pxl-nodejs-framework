# Performance Monitoring Guide

How to operationalize the built-in performance monitor.

## Enable

Enabled by default. Explicit config:

```ts
PerformanceMonitor.initialize({
  enabled: true,
  logSlowOperations: true,
  logAllOperations: false,
  thresholds: { http: 800 },
});
```

## Export Metrics

```ts
setInterval(() => {
  const report = perf.generateReport();
  pushToMetricsBackend(report.summary.averages);
}, 10000);
```

## Custom Operations

Use `type: 'custom'` for arbitrary spans.

```ts
const start = perf.startMeasure('resize-image', 'custom');
// ...
perf.endMeasure(start);
```

## Alerting

Set thresholds near SLO targets so WARN logs surface issues early.
