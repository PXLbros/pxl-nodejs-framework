# Cache / Redis

Redis integration is available for caching, pub/sub, and ephemeral state.

## Config

```ts
const app = new Application({
  redis: { host: '127.0.0.1', port: 6379 },
});
```

## Usage

```ts
await app.redis.client.set('key', 'value');
const v = await app.redis.client.get('key');
```

## Pub/Sub (example)

```ts
const sub = app.redis.client.duplicate();
await sub.connect();
await sub.subscribe('events', msg => app.logger.info({ msg }));
```
