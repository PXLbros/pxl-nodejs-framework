# Performance Monitoring Guide

The built-in Performance Monitor captures latency metrics across core operation types: `http`, `database`, `cache`, `queue`, `websocket`, and `custom` spans you instrument manually.

## Goals

- Cheap, low-overhead aggregation
- Fast identification of slow paths
- Export-friendly structured reports

## Initialization

Often implicitly initialized; explicit usage:

```ts
import { PerformanceMonitor } from '@scpxl/nodejs-framework/performance';

const perf = PerformanceMonitor.getInstance({
  enabled: true,
  logSlowOperations: true,
  logAllOperations: false,
  thresholds: { http: 800, database: 400 },
});
```

## Measuring Code

### Manual Start/End

```ts
const token = perf.startMeasure('list-users', 'database');
// ... query
perf.endMeasure(token);
```

### Async Wrapper

```ts
await perf.measureAsync({
  name: 'email-send',
  type: 'queue',
  fn: async () => sendEmail(data),
});
```

### Custom Spans

Use `custom` for anything not covered:

```ts
await perf.measureAsync({ name: 'image-resize', type: 'custom', fn: resizeFn });
```

## Report Anatomy

`perf.generateReport()` returns:

```jsonc
{
  "summary": {
    "counts": { "http": 42, "database": 18 },
    "averages": { "http": 120.5, "database": 45.1 },
    "percentiles": { "http": { "p50": 90, "p95": 250, "p99": 400 } },
  },
  "spans": [{ "name": "GET /users", "type": "http", "durationMs": 132, "ts": 1733333333 }],
}
```

Use `generateFormattedReport('simple')` for human-readable output.

## Threshold Strategy

Set thresholds slightly tighter than your SLO target so warnings show early. Example mapping:

| Type     | SLO p95 | Threshold |
| -------- | ------- | --------- |
| http     | 1000 ms | 800 ms    |
| database | 500 ms  | 400 ms    |
| cache    | 80 ms   | 60 ms     |

Update dynamically:

```ts
perf.setThresholds({ http: 700 });
```

## Logging Slow Operations

If `logSlowOperations` is true, operations exceeding threshold emit a warn-level log with metadata. Keep this enabled in staging to tune before production.

## Exporting Metrics

Periodic push:

```ts
setInterval(() => {
  const { summary } = perf.generateReport();
  pushMetrics('perf_http_avg_ms', summary.averages.http);
  pushMetrics('perf_http_p95_ms', summary.percentiles?.http?.p95);
}, 15000);
```

Use tags/labels (service, version, env) when integrating with a TSDB.

## Span Naming Conventions

| Context | Pattern             | Example           |
| ------- | ------------------- | ----------------- |
| HTTP    | METHOD pathTemplate | `GET /users/:id`  |
| DB      | action:entity       | `select:user`     |
| Queue   | jobName             | `email:send`      |
| Cache   | op:keyPrefix        | `get:user:`       |
| Custom  | domain:action       | `media:transcode` |

Consistent naming improves aggregation & dashboards.

## Disabling Temporarily

```ts
perf.setEnabled(false); // stops recording new spans
```

## Memory Considerations

If span count grows large, you can periodically truncate detailed spans while preserving aggregated counters (future optimization may be available). For now, build exporters that reset state if necessary.

## Dashboard Ideas

| Chart                 | Metric                                     |
| --------------------- | ------------------------------------------ |
| HTTP p95              | `perf_http_p95_ms`                         |
| DB avg                | `perf_db_avg_ms`                           |
| Slow op count         | Count of spans > threshold grouped by type |
| Queue processing time | `perf_queue_avg_ms`                        |

## Troubleshooting

| Issue               | Cause                    | Resolution                        |
| ------------------- | ------------------------ | --------------------------------- |
| No spans recorded   | Monitor disabled         | Enable or ensure initialization   |
| Missing percentiles | Insufficient samples     | Increase traffic / wait           |
| Excessive warn logs | Thresholds too low       | Tune upward gradually             |
| Memory usage growth | Retaining too many spans | Reduce retention / export & reset |

## Example Export + Reset Cycle

```ts
setInterval(() => {
  const report = perf.generateReport();
  ship(report);
  perf.reset(); // if a reset method exists in implementation
}, 60000);
```

## Next

- Deep dive into spans: [Performance Concept](/concepts/performance)
- Add structured logging: [Logging & Observability](/guides/logging)
- Scale considerations: [Scaling](/guides/scaling)

---

Planned: OpenTelemetry bridge adapter for distributed traces.
