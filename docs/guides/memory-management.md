# Memory Management

## Overview

The PXL framework implements several memory management strategies to prevent memory leaks, particularly around MikroORM's EntityManager identity map. This guide covers best practices and patterns for memory-safe code.

## EntityManager Lifecycle

MikroORM's EntityManager maintains an identity map that accumulates entities in memory. **Always clean up EntityManager instances** to prevent unbounded memory growth.

### The Problem

```typescript
// ❌ WRONG - Memory Leak
class MyService {
  private em = databaseInstance.getEntityManager(); // Created once

  async getUser(id: number) {
    // Identity map grows with each call - never cleared!
    return this.em.findOne('User', { id });
  }
}
```

After 10,000 calls, the identity map contains 10,000 User entities in memory, even though most are no longer needed.

### The Solution

Use request-scoped or operation-scoped EntityManagers with automatic cleanup.

## Safe Patterns by Context

### HTTP Requests (EntityController)

**EntityController** automatically provides request-scoped EntityManager with cleanup after each request.

```typescript
class UserController extends EntityController {
  protected entityName = 'User';

  // ✅ CORRECT - Automatic cleanup
  protected async preGetMany({ entityManager, request, reply }) {
    // entityManager is request-scoped - different instance per request
    // Automatically cleaned up after response
    const count = await entityManager.count('User', {});
  }
}
```

**For custom routes:**

```typescript
class MyController extends EntityController {
  async customRoute(request: FastifyRequest, reply: FastifyReply) {
    // ✅ CORRECT - Request-scoped EM
    await this.databaseInstance.withEntityManager(async em => {
      const users = await em.find('User', {});
      reply.send({ users });
    });
  }
}
```

### Queue Jobs (BaseProcessor)

Use lifecycle hooks or `withEntityManager()` helper for automatic cleanup.

#### Option 1: Lifecycle Hooks

```typescript
class MyProcessor extends BaseProcessor {
  private jobEntityManager?: EntityManager;

  async beforeProcess({ job }) {
    // Setup: Fork EntityManager
    this.jobEntityManager = this.databaseInstance.getEntityManager();
  }

  async process({ job }) {
    // Use the forked EM
    const user = await this.jobEntityManager.findOne('User', {
      id: job.data.userId,
    });
    return { userId: user.id };
  }

  async afterProcess({ job }) {
    // Cleanup: Clear identity map
    this.jobEntityManager?.clear();
    delete this.jobEntityManager;
  }
}
```

#### Option 2: Helper Method (Recommended)

```typescript
class MyProcessor extends BaseProcessor {
  async process({ job }) {
    // ✅ CORRECT - Automatic cleanup
    return this.withEntityManager(async em => {
      const user = await em.findOne('User', { id: job.data.userId });
      await em.persistAndFlush(user);
      return { userId: user.id };
    });
  }
}
```

### WebSocket Controllers

**WebSocket controllers are LONG-LIVED SINGLETONS** - one instance handles ALL connections throughout the application lifetime.

```typescript
// ❌ WRONG - Memory Leak
class ChatController extends WebSocketServerBaseController {
  private em = this.databaseInstance.getEntityManager(); // LEAK!

  async handleMessage(ws, data) {
    // Identity map grows forever across all connections
    await this.em.findOne('User', { id: data.userId });
  }
}
```

```typescript
// ✅ CORRECT - Per-message EntityManager
class ChatController extends WebSocketServerBaseController {
  async handleMessage(ws, data) {
    await this.databaseInstance.withEntityManager(async em => {
      const user = await em.findOne('User', { id: data.userId });
      // em automatically cleaned up after this block
    });
  }
}
```

### Custom Services

```typescript
class UserService {
  constructor(private databaseInstance: DatabaseInstance) {}

  // ✅ CORRECT - Caller manages EM lifecycle
  async getUser(em: EntityManager, userId: number) {
    return em.findOne('User', { id: userId });
  }

  // ✅ CORRECT - Self-contained with cleanup
  async findActiveUsers() {
    return this.databaseInstance.withEntityManager(async em => {
      return em.find('User', { active: true });
    });
  }
}
```

## Helper Methods

### DatabaseInstance.withEntityManager()

Executes a callback with a fresh EntityManager that's automatically cleaned up.

```typescript
await databaseInstance.withEntityManager(async em => {
  const user = await em.findOne('User', { id: 1 });
  return user;
});
// em.clear() called automatically, even if callback throws
```

### DatabaseInstance.withTransaction()

Same as `withEntityManager()` but wraps execution in a transaction.

```typescript
await databaseInstance.withTransaction(async em => {
  const user = em.create('User', { name: 'John' });
  await em.persistAndFlush(user);
  return user;
});
// Transaction committed and em.clear() called automatically
```

### DatabaseInstance.getEntityManager() (Deprecated)

⚠️ **Use with caution** - you must manually call `em.clear()`.

```typescript
// Only use when necessary
const em = databaseInstance.getEntityManager();
try {
  const users = await em.find('User', {});
  return users;
} finally {
  em.clear(); // MUST clean up manually
}
```

**Prefer `withEntityManager()` instead** for automatic cleanup.

## Anti-Patterns

### ❌ DON'T: Store EntityManager in Singleton

```typescript
class MyService {
  private em = databaseInstance.getEntityManager(); // LEAK!

  async getUser(id: number) {
    return this.em.findOne('User', { id }); // Identity map grows forever
  }
}
```

**Why it's wrong:** Service instances are often singletons. The EntityManager is reused across multiple operations, accumulating entities in the identity map.

### ❌ DON'T: Forget to clear EntityManager

```typescript
const em = databaseInstance.getEntityManager();
await em.find('User', {});
// MISSING: em.clear();
```

**Why it's wrong:** Memory leak - entities remain in identity map indefinitely.

### ❌ DON'T: Share EntityManager across requests

```typescript
class MyController extends BaseController {
  private em = databaseInstance.getEntityManager(); // LEAK!

  async route1(request, reply) {
    await this.em.find('User', {}); // Entities accumulate
  }

  async route2(request, reply) {
    await this.em.find('Order', {}); // More entities accumulate
  }
}
```

**Why it's wrong:** Each request adds more entities to the shared identity map.

## Performance Considerations

### EntityManager.fork() is Lightweight

Forking an EntityManager is fast (<1ms). Don't avoid forking for performance reasons.

```typescript
// ✅ CORRECT - Fork per request is fine
app.get('/users', async (request, reply) => {
  await databaseInstance.withEntityManager(async em => {
    return em.find('User', {});
  });
});
```

### Identity Map Benefits

The identity map provides:

- **Object identity**: Same entity = same object reference
- **Performance**: Reduces duplicate queries
- **Consistency**: Prevents conflicting entity states

But it must be cleared to prevent memory leaks.

### When to Share EntityManager

Only share EntityManager within a **single operation scope**:

```typescript
// ✅ CORRECT - Share within single transaction
await databaseInstance.withTransaction(async em => {
  const user = await userService.getUser(em, 1);
  const order = await orderService.createOrder(em, user);
  await notificationService.notify(em, user, order);
});
```

## Migration from v1.x

### Breaking Changes

**EntityController.entityManager removed** - use request-scoped EM instead.

#### Before (v1.x - Memory Leak)

```typescript
class MyController extends EntityController {
  async customRoute(request, reply) {
    const users = await this.entityManager.find('User', {});
    reply.send({ users });
  }
}
```

#### After (v2.x - Safe)

```typescript
class MyController extends EntityController {
  async customRoute(request, reply) {
    await this.databaseInstance.withEntityManager(async em => {
      const users = await em.find('User', {});
      reply.send({ users });
    });
  }
}
```

**Or use hooks** (recommended):

```typescript
class MyController extends EntityController {
  protected async preGetMany({ entityManager, request, reply }) {
    // entityManager is automatically request-scoped
    const count = await entityManager.count('User', {});
  }
}
```

## Production Monitoring

### Memory Growth Indicators

Monitor these metrics:

- **Heap growth over time**: Should stabilize, not grow indefinitely
- **GC frequency**: Frequent full GCs may indicate memory pressure
- **Request latency**: Increases as identity maps grow

### Debugging Memory Leaks

```typescript
// Add logging to track EM lifecycle
await databaseInstance.withEntityManager(async em => {
  console.log('EM created');
  const result = await em.find('User', {});
  console.log('EM will be cleared');
  return result;
});
// em.clear() called here
```

### Heap Snapshots

Take heap snapshots to identify retained entities:

```bash
node --inspect your-app.js
# Chrome DevTools → Memory → Take Heap Snapshot
# Look for retained MikroORM entities
```

## Summary

**Golden Rules:**

1. ✅ **Use `withEntityManager()` for automatic cleanup**
2. ✅ **Request-scoped EM in HTTP handlers**
3. ✅ **Operation-scoped EM in queue processors**
4. ✅ **Never store EM in long-lived objects (singletons)**
5. ✅ **Always call `em.clear()` if using `getEntityManager()` directly**

Following these patterns ensures your application maintains stable memory usage under load.

## See Also

- [WebSocket Guide](./websocket.md)
- [Performance Monitoring](./performance-monitoring.md)
- [Commands Guide](./commands.md)
- [Testing Guide](./testing.md)
