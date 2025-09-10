# Performance

Built-in performance monitoring captures durations across HTTP, database, cache, queue, websocket, and custom operations.

## Quick Start

```ts
import { PerformanceMonitor } from '@scpxl/nodejs-framework/performance';

const perf = PerformanceMonitor.getInstance({ logSlowOperations: true });

const start = perf.startMeasure('list-users', 'database');
// ... query
perf.endMeasure(start);
```

## Async Helper

```ts
await perf.measureAsync({
  name: 'job-process',
  type: 'queue',
  fn: async () => processJob(job),
});
```

## Thresholds

Defaults (ms): http 1000, database 500, cache 100, queue 2000, websocket 200, custom 1000.

Override:

```ts
perf.setThresholds({ database: 300 });
```

## Reports

```ts
perf.generateReport(); // structured JSON
perf.generateFormattedReport('simple');
```

## Disabling

```ts
perf.setEnabled(false);
```

## Patterns

- Wrap critical paths to catch regressions.
- Ship metrics into your APM by reading `perf.getMetrics()` on an interval.
