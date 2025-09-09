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
