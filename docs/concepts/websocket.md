# WebSocket

Provides realtime capabilities with client + room management.

## Connection

```ts
app.websocket.onConnection(client => {
  client.sendJSON({ welcome: true });
});
```

## Rooms

```ts
const room = app.websocket.rooms.join('updates', client);
room.broadcast({ type: 'USER_JOINED' });
```

## Sending Data

```ts
client.sendJSON({ event: 'ping' });
```

## Heartbeats

Use periodic pings for liveness if needed (depends on infra / proxies).
