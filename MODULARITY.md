# Breaking Up BaseApplication: Service Container Architecture

## Overview

This document outlines the plan to refactor the monolithic `BaseApplication` god object into a clean, modular service container architecture using dependency injection patterns.

## Current Issues with BaseApplication

- **God Object Anti-pattern**: Orchestrates config, cache, database, queue, events, performance, signals
- **Tight Coupling**: Services are tightly coupled to BaseApplication constructor
- **Hard-coded Dependencies**: Service dependencies are hard-coded rather than injected
- **No Abstraction Layer**: Direct manager instantiation without interfaces
- **Limited Extensibility**: Difficult to add new services without modifying BaseApplication

## Proposed Architecture

### Core Components

#### 1. ApplicationContext (Service Container)

The central service container that manages all application services.

```typescript
interface ApplicationContext {
  register<T>(token: ServiceToken<T>, provider: ServiceProvider<T>): void;
  resolve<T>(token: ServiceToken<T>): T;
  resolveAsync<T>(token: ServiceToken<T>): Promise<T>;
  has(token: ServiceToken): boolean;
  dispose(): Promise<void>;
}
```

#### 2. Service Provider Pattern

Each service is registered via a provider that handles instantiation and lifecycle.

```typescript
interface ServiceProvider<T> {
  provide(context: ApplicationContext): T | Promise<T>;
  dispose?(instance: T): void | Promise<void>;
  singleton?: boolean;
}
```

#### 3. Service Modules

Logical groupings of related services with their own configuration and lifecycle.

```typescript
abstract class ServiceModule {
  abstract register(context: ApplicationContext): void;
  abstract initialize?(): Promise<void>;
  abstract start?(): Promise<void>;
  abstract stop?(): Promise<void>;
}
```

## Service Module Breakdown

### ConfigModule

**Responsibilities:**

- Configuration loading from environment variables
- Schema validation using Zod
- Configuration freezing after initialization
- Type-safe configuration access

**Services Provided:**

- `ConfigService`: Central configuration access
- `EnvironmentService`: Environment variable management
- `ValidationService`: Configuration validation

### CacheModule

**Responsibilities:**

- Cache service registration and management
- Redis-based caching with lazy connections
- Cache invalidation strategies
- TTL management

**Services Provided:**

- `CacheService`: High-level caching operations
- `CacheProvider`: Low-level cache access

### DatabaseModule

**Responsibilities:**

- Database connection management
- MikroORM integration
- Entity discovery and registration
- Migration management
- Connection pooling

**Services Provided:**

- `DatabaseService`: Database operations
- `EntityManager`: ORM entity management
- `MigrationService`: Database migrations

### MessagingModule

**Responsibilities:**

- Queue management (BullMQ)
- Event system management
- Job processor registration
- Event handler registration
- Message routing

**Services Provided:**

- `QueueService`: Job queue operations
- `EventService`: Event pub/sub
- `MessageBus`: Internal message routing

### MetricsModule

**Responsibilities:**

- Performance monitoring
- Metrics collection and aggregation
- Reporting and alerting
- Integration with monitoring services

**Services Provided:**

- `MetricsService`: Metrics collection
- `PerformanceMonitor`: Performance tracking
- `ReportingService`: Metrics reporting

### WebModule

**Responsibilities:**

- HTTP server management (Fastify)
- WebSocket server/client
- Route registration
- Middleware management
- Request/response handling

**Services Provided:**

- `WebServer`: HTTP server
- `WebSocketService`: WebSocket communication
- `RouterService`: Route management
- `MiddlewareService`: Middleware pipeline

## Implementation Structure

```
src/
├── container/
│   ├── application-context.ts        # Service container implementation
│   ├── service-provider.ts           # Provider interfaces and base classes
│   ├── service-module.ts             # Base module class
│   ├── service-token.ts              # Type-safe service tokens
│   └── index.ts                      # Container exports
│
├── modules/
│   ├── config/
│   │   ├── config.module.ts          # Configuration module
│   │   ├── config.service.ts         # Configuration service
│   │   ├── config.provider.ts        # Configuration provider
│   │   └── index.ts
│   │
│   ├── cache/
│   │   ├── cache.module.ts           # Cache module
│   │   ├── cache.service.ts          # Cache service
│   │   ├── cache.provider.ts         # Cache provider
│   │   └── index.ts
│   │
│   ├── database/
│   │   ├── database.module.ts        # Database module
│   │   ├── database.service.ts       # Database service
│   │   ├── database.provider.ts      # Database provider
│   │   ├── entity.service.ts         # Entity management
│   │   └── index.ts
│   │
│   ├── messaging/
│   │   ├── messaging.module.ts       # Messaging module
│   │   ├── queue.service.ts          # Queue service
│   │   ├── event.service.ts          # Event service
│   │   ├── message-bus.service.ts    # Message bus
│   │   └── index.ts
│   │
│   ├── metrics/
│   │   ├── metrics.module.ts         # Metrics module
│   │   ├── metrics.service.ts        # Metrics service
│   │   ├── performance.service.ts    # Performance monitoring
│   │   └── index.ts
│   │
│   └── web/
│       ├── web.module.ts             # Web module
│       ├── web.service.ts            # Web server service
│       ├── websocket.service.ts      # WebSocket service
│       ├── router.service.ts         # Router service
│       └── index.ts
│
├── application/
│   ├── application.ts                # New clean application class
│   ├── application-builder.ts        # Fluent builder API
│   └── index.ts
│
└── core/
    ├── lifecycle/                    # Existing lifecycle management
    ├── logger/                       # Existing logger
    └── errors/                       # Error handling

```

## Service Registration Flow

```typescript
// 1. Create application context
const context = new ApplicationContext();

// 2. Register modules
const configModule = new ConfigModule(configOptions);
const databaseModule = new DatabaseModule(dbOptions);
const cacheModule = new CacheModule(cacheOptions);
const webModule = new WebModule(webOptions);

context.registerModule(configModule);
context.registerModule(databaseModule);
context.registerModule(cacheModule);
context.registerModule(webModule);

// 3. Initialize modules
await context.initialize();

// 4. Start application
await context.start();
```

## Clean API Design

### Application Builder Pattern

```typescript
const app = await Application.create()
  .withConfig(configOptions)
  .withDatabase(databaseOptions)
  .withCache(cacheOptions)
  .withQueue(queueOptions)
  .withWeb(webOptions)
  .build();

await app.start();
```

### Direct Module Registration

```typescript
const app = new Application();

app.use(new ConfigModule(options));
app.use(new DatabaseModule(options));
app.use(new CacheModule(options));
app.use(new WebModule(options));

await app.bootstrap();
await app.start();
```

### Service Resolution

```typescript
// Type-safe service resolution
const config = app.resolve(ConfigService);
const database = app.resolve(DatabaseService);
const cache = app.resolve(CacheService);

// Async service resolution
const queue = await app.resolveAsync(QueueService);
```

## Dependency Injection

### Service Dependencies

```typescript
class QueueService {
  constructor(
    private readonly redis: RedisService,
    private readonly database: DatabaseService,
    private readonly events: EventService,
    private readonly config: ConfigService,
  ) {}
}

class QueueProvider implements ServiceProvider<QueueService> {
  async provide(context: ApplicationContext): Promise<QueueService> {
    const redis = await context.resolveAsync(RedisService);
    const database = await context.resolveAsync(DatabaseService);
    const events = context.resolve(EventService);
    const config = context.resolve(ConfigService);

    return new QueueService(redis, database, events, config);
  }
}
```

### Circular Dependencies

Handle circular dependencies through lazy resolution:

```typescript
class ServiceA {
  constructor(private readonly context: ApplicationContext) {}

  get serviceB(): ServiceB {
    return this.context.resolve(ServiceB);
  }
}
```

## Lifecycle Management

### Module Lifecycle Phases

1. **Registration**: Module registers its services
2. **Initialization**: Services are instantiated
3. **Configuration**: Services are configured
4. **Start**: Services begin operation
5. **Ready**: Services are ready for traffic
6. **Stop**: Graceful shutdown
7. **Dispose**: Resource cleanup

### Lifecycle Hooks

```typescript
class DatabaseModule extends ServiceModule {
  async initialize() {
    // Connect to database
  }

  async start() {
    // Run migrations
  }

  async stop() {
    // Close connections
  }

  async dispose() {
    // Clean up resources
  }
}
```

## Testing Strategy

### Unit Testing

```typescript
describe('CacheModule', () => {
  let context: ApplicationContext;
  let module: CacheModule;

  beforeEach(() => {
    context = new ApplicationContext();
    module = new CacheModule(options);
  });

  it('should register cache service', () => {
    module.register(context);
    expect(context.has(CacheService)).toBe(true);
  });
});
```

### Integration Testing

```typescript
describe('Application Integration', () => {
  it('should resolve cross-module dependencies', async () => {
    const app = Application.create()
      .withConfig(testConfig)
      .withDatabase(testDbConfig)
      .withCache(testCacheConfig)
      .build();

    await app.start();

    const queue = app.resolve(QueueService);
    expect(queue).toBeDefined();

    await app.stop();
  });
});
```

### Mocking Services

```typescript
class MockDatabaseService implements DatabaseService {
  // Mock implementation
}

context.register(DatabaseService, {
  provide: () => new MockDatabaseService(),
  singleton: true,
});
```

## Benefits of New Architecture

1. **Separation of Concerns**: Each module handles a specific domain
2. **Dependency Injection**: Clear dependency management
3. **Testability**: Easy to mock and test services
4. **Extensibility**: Simple to add new modules/services
5. **Type Safety**: Full TypeScript support with type-safe tokens
6. **Lazy Loading**: Services loaded only when needed
7. **Clean API**: Intuitive and modern API design
8. **Modularity**: Modules can be used independently

## Migration Path

### Phase 1: Infrastructure (Week 1)

- Implement ApplicationContext
- Create ServiceProvider interface
- Build ServiceModule base class
- Add service tokens

### Phase 2: Core Modules (Week 2)

- Extract ConfigModule
- Extract CacheModule
- Extract DatabaseModule
- Add comprehensive tests

### Phase 3: Complex Modules (Week 3)

- Extract MessagingModule (Queue + Events)
- Extract MetricsModule
- Extract WebModule
- Integration testing

### Phase 4: New Application Class (Week 4)

- Create new Application class
- Implement ApplicationBuilder
- Add lifecycle management
- Performance testing

### Phase 5: Documentation & Polish (Week 5)

- Complete API documentation
- Architecture diagrams
- Example applications
- Performance optimization

## Example: Complete Application

```typescript
import { Application } from '@pxl/framework';
import { ConfigModule, DatabaseModule, CacheModule, WebModule, QueueModule } from '@pxl/framework/modules';

async function createApp() {
  const app = await Application.create()
    .withModule(ConfigModule, {
      envFile: '.env',
      schema: appConfigSchema,
    })
    .withModule(DatabaseModule, {
      type: 'postgres',
      migrations: './migrations',
      entities: './src/entities',
    })
    .withModule(CacheModule, {
      ttl: 3600,
      maxSize: 1000,
    })
    .withModule(QueueModule, {
      queues: ['email', 'notifications'],
      processors: './src/processors',
    })
    .withModule(WebModule, {
      port: 3000,
      cors: true,
      routes: './src/routes',
    })
    .build();

  // Service resolution
  const config = app.resolve(ConfigService);
  const db = app.resolve(DatabaseService);
  const web = app.resolve(WebService);

  // Custom initialization
  await db.runMigrations();

  // Start application
  await app.start();

  console.log(`Application started on port ${config.get('port')}`);

  return app;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.stop();
  process.exit(0);
});

createApp().catch(console.error);
```

## Success Metrics

- **Code Reduction**: 40% less code in application setup
- **Test Coverage**: >90% coverage for all modules
- **Performance**: <100ms cold start time
- **Memory**: <50MB base memory footprint
- **Developer Experience**: Setup time reduced from 30min to 5min

## Open Questions

1. Should we support decorator-based injection for cleaner syntax?
2. Should modules auto-register based on configuration?
3. How should we handle module versioning?
4. Should we provide a compatibility layer for existing code?

## Next Steps

1. Review and approve this plan
2. Create proof of concept for ApplicationContext
3. Extract first module (ConfigModule) as reference implementation
4. Gather feedback and iterate
5. Proceed with full implementation

---

# ANALYSIS & RECOMMENDATIONS

## Assessment: Over-Engineered for Current Framework Size

### Current Architecture Strengths

The PXL framework **already has many of the desired qualities** without the complexity of a full DI container:

1. **✅ Lifecycle Management** - Robust `LifecycleManager` with phases, hooks, and readiness checks
2. **✅ Separation of Concerns** - Each manager class has clear responsibilities
3. **✅ Configuration Validation** - Recently added Zod validation with fail-fast behavior
4. **✅ Explicit Dependencies** - Clear dependency passing makes debugging straightforward
5. **✅ Simple API** - `new WebApplication(config)` → `app.start()` is intuitive
6. **✅ Testability** - Managers accept dependencies via constructors (easy to mock)
7. **✅ Plugin System** - `PerformanceMonitorPlugin` shows existing extensibility pattern
8. **✅ Modular Exports** - Package.json has granular exports for tree-shaking

**Framework Scale:** ~15 core services, not 100+. The proposed DI container architecture shows diminishing returns at this scale.

### Problems with Proposed Modularity Approach

#### 1. **Excessive Abstraction Layers**

- Adds 3 new concepts: ApplicationContext, ServiceProvider, ServiceModule
- Requires learning dependency injection container patterns
- Increases cognitive load for contributors

#### 2. **Functionality Duplication**

- Proposed lifecycle phases duplicate existing `LifecycleManager`
- Both systems would need maintenance
- Adds confusion: "Which lifecycle system do I use?"

#### 3. **Breaking Changes Without Clear Path**

```typescript
// Current (simple, explicit)
new WebApplication(config).start()

// Proposed (more complex)
await Application.create()
  .withModule(ConfigModule, {...})
  .withModule(DatabaseModule, {...})
  .build()
```

All existing applications would need complete rewrites.

#### 4. **Circular Dependency Workarounds**

The proposed lazy resolution pattern indicates the abstraction may not fit naturally:

```typescript
class ServiceA {
  constructor(private readonly context: ApplicationContext) {}
  get serviceB(): ServiceB {
    return this.context.resolve(ServiceB);
  }
}
```

This is more complex than direct constructor injection.

#### 5. **Questionable ROI**

- **Testability**: Already achievable with constructor injection
- **Extensibility**: Already achievable with plugins
- **Type Safety**: Lost when using `context.resolve(Token)` vs direct properties
- **Debugging**: Service resolution adds indirection, making stack traces harder to follow

### Alternative Approaches (Recommended)

#### **Option 1: Lightweight Service Factory Pattern** ⭐ Recommended First Step

Instead of a full DI container, extract initialization logic to factories:

```typescript
// src/factories/application-factory.ts
export class ApplicationFactory {
  static createRedisManager(config: ApplicationConfig): RedisManager {
    return new RedisManager({
      applicationConfig: config,
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });
  }

  static createCacheManager(config: ApplicationConfig, redisManager: RedisManager): CacheManager {
    return new CacheManager({ redisManager });
  }

  static async createDatabaseManager(config: ApplicationConfig): Promise<DatabaseManager | undefined> {
    if (!config.database?.enabled) return undefined;

    return new DatabaseManager({
      applicationConfig: config,
      host: config.database.host,
      port: config.database.port,
      username: config.database.username,
      password: config.database.password,
      databaseName: config.database.databaseName,
      entitiesDirectory: config.database.entitiesDirectory,
    });
  }
}
```

**Benefits:**

- Zero breaking changes
- Reduces boilerplate in BaseApplication constructor
- Easy to test
- Maintains explicit dependencies
- No new concepts to learn

#### **Option 2: Plugin Architecture** ⭐ Best for Extensibility

Expand the existing `PerformanceMonitorPlugin` pattern:

```typescript
// src/plugins/plugin.interface.ts
export interface ApplicationPlugin {
  name: string;
  register(app: BaseApplication): void | Promise<void>;
  initialize?(): void | Promise<void>;
  dispose?(): void | Promise<void>;
}

// Usage
const app = new WebApplication(config);
app.use(new CachePlugin());
app.use(new MetricsPlugin());
app.use(new CustomBusinessLogicPlugin());
await app.start();
```

**Benefits:**

- Makes services truly optional
- Users can add custom plugins
- Non-breaking (opt-in)
- Familiar pattern (Fastify, Express use this)

#### **Option 3: Builder Pattern (Convenience Layer)**

Add optional builder without changing core:

```typescript
// Convenience layer
const app = await ApplicationBuilder.create(config).withDatabase().withCache().withQueue().build();

// Still works
const app = new WebApplication(config);
```

**Benefits:**

- Fluent API for those who want it
- Doesn't force migration
- Reduces config verbosity

#### **Option 4: Configuration Presets**

```typescript
// src/config/presets.ts
export const WebAppPreset = {
  redis: true,
  database: true,
  cache: true,
  queue: true,
  webServer: true,
};

export const WorkerPreset = {
  redis: true,
  database: true,
  queue: true,
  webServer: false,
};

// Usage
const config = createConfig(WebAppPreset, customOverrides);
```

### Incremental Migration Path (If Full Modularity is Still Desired)

If you still want to pursue the full modularity approach, do it incrementally:

#### Phase 1: Extract One Module (Proof of Concept)

- Implement only `CacheModule` with ApplicationContext
- Provide **dual API** (old + new) for 2-3 versions
- Gather real feedback from users

#### Phase 2: Add Compatibility Layer

```typescript
// Old API (still works)
const app = new WebApplication(config);

// New API (opt-in)
const app = await Application.create().withModules([...]).build();

// Internally, old API uses new system
```

#### Phase 3: Deprecation Warnings

- Add console warnings for old API
- Provide migration guide
- Give users 6-12 months to migrate

#### Phase 4: Remove Old API

- Major version bump
- Complete migration

### Recommended Immediate Actions

1. **Identify Real Pain Points** - Survey actual users about what's hard in current API
2. **Start with Factory Pattern** - Simplest improvement, zero risk
3. **Expand Plugin System** - Builds on existing pattern
4. **Add Builder Pattern** - Optional convenience layer
5. **Measure Impact** - Before/after developer experience surveys

### Questions to Answer Before Proceeding

1. **Who asked for this?** - Is this solving a real user problem or theoretical?
2. **What's the specific pain point?** - "God object" is a symptom, not the root cause
3. **How many services will this framework have?** - If staying ~15, DI may be overkill
4. **Can we solve this with composition?** - Instead of DI container
5. **What's the migration cost?** - How many apps would need updates?

### Alternative: Improve Current Architecture

Sometimes the best refactor is targeted improvements:

1. **Extract Large Methods** - Break down `BaseApplication.constructor`
2. **Add Service Interfaces** - Enable better mocking
3. **Improve Configuration** - Better defaults, validation messages
4. **Better Documentation** - Architecture diagrams, recipes
5. **Example Applications** - Show best practices

### Conclusion

The modularity proposal is **well-designed but likely over-engineered** for a framework with ~15 services. The ROI doesn't justify the complexity and breaking changes.

**Recommended path:**

1. Start with **factory pattern** (low risk, immediate value)
2. Expand **plugin architecture** (aligns with framework goals)
3. Add **builder pattern** as convenience layer
4. Gather real user feedback
5. Only proceed with full DI container if clear demand emerges

The current architecture is solid. Focus on refinement over revolution.
