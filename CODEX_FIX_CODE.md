# Code Health Findings

- ✅ **CacheManager race on initial Redis connection** (`src/cache/manager.ts:54`): `getRedisInstance` now shares a single in-flight `connect()` promise, preventing duplicate workers under concurrent load. Added `reuses in-flight connection` unit test (`test/unit/cache/cache-manager.test.ts`).
- ✅ **Boolean payloads rejected by Redis cache adapter** (`src/redis/instance.ts:77`): `setCache` accepts booleans, bigints, buffers, and null safely, keeping JSON semantics intact. Extended coverage in `redis-instance.test.ts` for booleans/bigints.
- ✅ **Job metadata update runs out-of-band** (`src/queue/manager.ts:265`): `workerProcessor` awaits `job.updateData` and logs failures without skipping processing. Added targeted tests to ensure awaiting + warning behavior.
- ✅ **WebSocket controller handlers lose `this` binding** (`src/websocket/websocket-base.ts:77`): Route registration now validates and binds controller actions, preserving instance state. New binding test ensures controllers keep internal counters.
- ✅ **Predictable WebSocket client IDs** (`src/websocket/utils.ts:8`): Client IDs switched to `crypto.randomUUID()` with secure `randomBytes` fallback; tests updated to cover both paths.
- ✅ **Global error handlers registered per application instance** (`src/application/base-application.ts:403`): Global error listeners registered once and broadcast across live instances via weak references. Constructor tests confirm listener counts stay constant.
