# Queue

Queue processing built on BullMQ.

## Defining a Job

```ts
await app.queue.manager.add('email', { userId: 123 });
```

## Worker

```ts
app.queue.manager.process('email', async job => {
  // send email for job.data.userId
});
```

## Delayed Jobs

```ts
await app.queue.manager.add('reminder', { id: 1 }, { delay: 60_000 });
```

## Concurrency

Set via process options. Use multiple workers or cluster mode.

## Per-Queue Runtime Settings

You can now configure runtime processing and default job behavior per queue for improved reliability and performance tuning.

```ts
import type { QueueItem } from '@scpxl/nodejs-framework/queue';

const queues: QueueItem[] = [
  {
    name: 'analytics-insights',
    jobs: [{ id: 'analytics-insights' }, { id: 'simple-video-analysis' }],
    // Runtime worker settings (BullMQ WorkerOptions)
    settings: {
      lockDuration: 300_000, // 5 min max lock before considered stalled
      stalledInterval: 30_000, // check stalls every 30s
      maxStalledCount: 2, // fail after 2 stalls (≈10 min total)
      concurrency: 5, // up to 5 jobs in parallel for this queue
    },
    // Default job options (BullMQ defaultJobOptions)
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 3, // retry up to 3 times
      backoff: { type: 'exponential', delay: 5_000 },
    },
  },
];
```

### Notes

- `settings` maps directly to BullMQ `WorkerOptions` (only the provided subset is applied).
- `defaultJobOptions` merges with framework defaults (`removeOnComplete` & `removeOnFail`).
- Omit any field to fall back to framework/BullMQ defaults.
- Adjust `concurrency` carefully—high values can increase Redis pressure and memory consumption.

### DX Tips

- Keep long-running, high-variance jobs (e.g. AI/video analysis) in their own queue to isolate stall/lock settings.
- Use `maxStalledCount` + logging to surface underlying processor issues early.
- Prefer exponential backoff for external API calls to smooth out transient failures.
