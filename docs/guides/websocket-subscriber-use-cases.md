# WebSocket Subscriber Use Cases

WebSocket subscriber handlers let you react to messages that travel through Redis between workers. They are ideal for cross-process coordination, background job notifications, and any custom event bus patterns you want to introduce without coupling logic to the framework config file.

## Getting Started

- Export handlers from a directory with `defineWebSocketSubscriber` or provide inline objects.
- Point the framework config at your handlers:

```ts
webSocket: {
  subscriberHandlers: {
    directory: path.join(baseDir, 'websocket', 'subscribers'),
    handlers: [
      {
        channels: ['*'], // optional inline handler for quick experiments
        handle: ({ channel, message }) => {
          console.debug('[subscriber]', channel, message);
        },
      },
    ],
  },
},
```

Each handler receives a `WebSocketSubscriberHandlerContext` with the Redis channel, parsed message payload, and access to services such as the WebSocket server, Redis, queue manager, and database instance.

## Use Cases

### 1. Broadcast Queue Job Results

Alert connected clients when long-running background work finishes.

```ts
export default defineWebSocketSubscriber({
  name: 'jobNotifications',
  channel: WebSocketRedisSubscriberEvent.QueueJobCompleted,
  handle: ({ message, webSocketServer }) => {
    webSocketServer.sendMessageToAll({
      data: {
        type: 'jobs',
        action: 'completed',
        data: message,
      },
    });
  },
});
```

### 2. Tailor Events by Room or Segment

Target a specific audience by matching on message content.

```ts
export default defineWebSocketSubscriber({
  name: 'roomAnnouncements',
  match: ({ channel, message }) => channel === WebSocketRedisSubscriberEvent.Custom && message?.room === 'support',
  handle: ({ message, webSocketServer }) => {
    webSocketServer.broadcastToRoom({
      roomName: 'support',
      data: {
        type: 'announcement',
        action: 'supportUpdate',
        data: message.data,
      },
    });
  },
});
```

### 3. Persist Real-Time Analytics

Store high-value metrics without blocking the request path.

```ts
export default defineWebSocketSubscriber({
  name: 'analyticsSink',
  match: [/^analytics:/],
  handle: async ({ message, databaseInstance }) => {
    const em = databaseInstance.getEntityManager();
    em.persist(new AnalyticsEvent(message));
    await em.flush();
  },
});
```

## Tips for Developer Experience

- Use the optional `priority` field to control execution order when multiple handlers listen to the same channel.
- Document intent with the `description` field so operational logs have more context.
- Wildcard listeners (`channels: ['*']`) are helpful while debugging to observe raw Redis traffic.
- When a handler throws, the framework logs the failure and continues, so keep your code defensive and log meaningful metadata.
- Co-locate subscribers with the feature that emits their messages to keep ownership clear.
- `match` accepts a string, regular expression, predicate, or an array of any combination—giving you fine-grained routing without additional boilerplate.

For more background, review the main WebSocket guide and the Hello World example, which now ships with a basic subscriber demonstration.
