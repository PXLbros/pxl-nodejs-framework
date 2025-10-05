# PXL Framework Extensibility & Plugin Architecture Refactor Plan

> Status: Draft (Initial capture of direction). Scope: Introduce first‑class plugin + DI/service architecture without breaking existing consumers. Tests intentionally excluded from this plan (handled separately).

## 1. Problem Statement

Current framework couples core services (Redis, DB, Queue, Event, WebServer, Performance, Logger) directly inside `BaseApplication`. Only one real plugin pattern (Performance) exists and it relies on internal property access. There is no unified lifecycle contribution model, no DI container, and no safe way for third parties (or internal feature packs) to extend config, register routes, attach middleware, or provide instrumentation. This blocks ecosystem growth, increases maintenance friction, and forces edits to core files for every new cross‑cutting concern.

## 2. Core Goals

1. Explicit Plugin API (deterministic ordering, dependency graph, lifecycle hooks)
2. Lightweight Service Registry / DI (singleton + scoped resolution)
3. Config Extensibility (plugins add/validate schema fragments)
4. Route & Middleware Pipeline (pre/post phases, policies, instrumentation)
5. Structured Lifecycle Hooks (initialize → start → ready → shutdown) externally consumable
6. Backward Compatibility (existing code continues to work for at least 2 minor versions)
7. Observability Hooks (events bus for internal state transitions)
8. Progressive Adoption (can ship in phases; partial implementation still delivers value)

## 3. Non‑Goals (for this iteration)

- Comprehensive security policy layer (future add‑on)
- Complete inversion of all existing singletons _immediately_
- Multi‑tenant isolation (future stretch)
- Hot reload of plugins (may come later for dev QoL)

## 4. High-Level Architecture Overview

```
┌───────────────────────────┐
│         Application       │
│  (BaseApplication + App)  │
└─────────────┬─────────────┘
              │ boot
      ┌───────▼────────┐
      │  PluginManager │  topo sort, dependency validation
      └───┬────────┬───┘
          │        │ register()
   ┌──────▼───┐  ┌─▼────────┐
   │ Services │  │ Plugins  │  (provide capabilities; may register services, routes, middleware)
   └────┬─────┘  └────┬─────┘
        │ resolve()   │ lifecycle hooks
        ▼             ▼
   Route Pipeline   Lifecycle Bus / Event Stream
```

## 5. Plugin Interface (Draft)

```ts
interface FrameworkPlugin {
  name: string; // unique
  version?: string;
  dependsOn?: string[]; // other plugin names
  provides?: string[]; // capability tokens

  extendConfig?(b: ConfigBuilder): void; // register Zod fragments / defaults
  register?(ctx: PluginContext): Promise<void> | void; // before init phase ends
  onStart?(ctx: RuntimeContext): Promise<void> | void; // after core services start
  onReady?(ctx: RuntimeContext): Promise<void> | void; // after readiness gates pass
  onShutdown?(ctx: RuntimeContext): Promise<void> | void; // graceful shutdown
}
```

## 6. Service Registry (Draft)

```ts
interface ServiceRegistry {
  register<T>(
    token: symbol | string,
    factory: (r: ResolveFn) => T,
    options?: { lifecycle?: 'singleton' | 'scoped' },
  ): void;
  resolve<T>(token: symbol | string): T; // throws if missing
  tryResolve<T>(token: symbol | string): T | undefined;
  has(token: symbol | string): boolean;
}
```

- Start with singleton-only; add scoped (per-request) later using AsyncLocalStorage.
- Wrap legacy singletons (`Logger`, `PerformanceMonitor`) and register them gradually.

## 7. Lifecycle Phases (Refined)

| Phase      | Trigger Source        | Responsibilities                       | Failure Policy       |
| ---------- | --------------------- | -------------------------------------- | -------------------- |
| initialize | app.start → pluginMgr | Config extension, service registration | Fail-fast            |
| start      | after initialize      | Connect external resources             | Collect errors, warn |
| ready      | readiness checks pass | Warm caches, emit ready event          | Log-only             |
| shutdown   | stop() or fatal error | Ordered teardown (reverse deps)        | Best-effort          |

## 8. Config Extensibility

Introduce `ConfigBuilder`:

```ts
interface ConfigBuilder {
  addNamespace(ns: string, schema: z.ZodTypeAny, options?: { mergeStrategy?: 'deep' | 'replace' }): void;
  extend(path: string, schema: z.ZodTypeAny): void; // path like 'web.debug'
}
```

Process:

1. Core provides base Framework schema.
2. Collect plugin extensions (pre-validation).
3. Compose into unified Zod object.
4. Validate user config once.

## 9. Route & Middleware Pipeline

Add middleware contract:

```ts
interface RouteMiddleware {
  name: string;
  phase?: 'pre-validate' | 'pre-handler' | 'post-handler' | 'error';
  apply(ctx: RouteContext, next: () => Promise<void>): Promise<void>;
}
```

Execution wrapper replaces direct Fastify binding:

1. Adapt existing handlers into pipeline.
2. Allow plugin to `registerRoute({ method, path, handler, middlewares: [...] })`.
3. Provide built-in middleware: timing, auth stub, request context injection.

## 10. Internal Event Bus

Lightweight typed emitter:

- Events: `plugin:registered`, `service:registered`, `route:mounted`, `lifecycle:phase`, `error:captured`.
- Consumers (e.g., observability plugin) subscribe without patching core.

## 11. Backward Compatibility Strategy

| Concern                                   | Strategy                                                 |
| ----------------------------------------- | -------------------------------------------------------- |
| Existing imports (`import { Logger }`)    | Keep exports; additionally register under token `logger` |
| Direct instantiation in `BaseApplication` | Migrate gradually; keep old path until phase 4           |
| PerformanceMonitorPlugin                  | First adopter of new API                                 |
| Config shape                              | Maintain current top-level; plugin namespaces appended   |

## 12. Phased Roadmap (Execution)

### Phase 0 (Bootstrap)

- ADR documenting motivation
- Add `ServiceRegistry` (no behavior change) & register Logger
- Metrics: count of direct singleton imports

### Phase 1 (PluginManager Skeleton)

- Implement topo sort + cycle detection
- Adapt Performance monitor → new plugin
- Hidden behind feature flag: `experimentalPlugins`

### Phase 2 (ConfigBuilder Integration)

- Collect plugin schema fragments pre-validation
- Expose extension failure diagnostics

### Phase 3 (Core Services via Registry)

- Register Redis, DB, Queue, Event, Performance
- Provide `app.services.resolve('redis')`
- Deprecation notice if direct property used (console warn in dev)

### Phase 4 (Route Pipeline + Middleware)

- Introduce middleware abstraction
- Wrap existing route registration
- Add timing + requestId middleware extracted from current hooks

### Phase 5 (Event Bus + Observability Hooks)

- Emit lifecycle events
- Provide sample Observability plugin (logs structured metrics)

### Phase 6 (Stabilization & Docs)

- Add migration guide
- Deprecate legacy plugin patterns
- Benchmark startup & request overhead

### Phase 7 (Optional Stretch)

- Per-request scoped DI
- Dynamic plugin toggling at runtime (dev mode)

## 13. Risk Matrix

| Risk                                        | Impact | Likelihood | Mitigation                                                     |
| ------------------------------------------- | ------ | ---------- | -------------------------------------------------------------- |
| Hidden coupling surfacing during extraction | Medium | High       | Incremental migration + feature flags                          |
| Performance regression in hot path          | High   | Medium     | Benchmark before/after; micro-opt path when no middleware      |
| Plugin dependency cycles                    | Medium | Medium     | Deterministic topo + clear error message                       |
| Version drift between plugins & core        | Medium | Low        | Add plugin `apiVersion` contract                               |
| Over-scoping early                          | High   | Medium     | Gate advanced features (scoped DI, hot reload) to later phases |

## 14. Metrics & Success Criteria

| Metric                                      | Baseline       | Target (post Phase 4)   |
| ------------------------------------------- | -------------- | ----------------------- |
| New cross-cutting feature LOC touching core | >5 files       | ≤2 files                |
| Time to add route with policy + timing      | Ad-hoc         | <2 steps                |
| Direct singleton imports                    | N (to measure) | -50%                    |
| Mean plugin init time logged                | Not measured   | Visible & <50ms typical |
| Added plugin without core edits             | Impossible     | Supported               |

## 15. Implementation Notes / Guardrails

- Favor explicit tokens over stringly-typed internal property access.
- Keep zero-cost path: if no plugins or middleware, pipeline adds <1 microtask.
- Avoid over-generalizing early (no full IoC container; keep pragmatic).
- Provide `debug.dump()` utilities for introspection.
- Document stability levels: `experimental` vs `stable` plugin APIs.

## 16. Open Questions

| Topic                      | Decision Needed                            |
| -------------------------- | ------------------------------------------ |
| Error boundary per plugin? | Catch + isolate vs. fail-fast strategy     |
| Config collisions          | Last-wins vs. error on duplicate namespace |
| Version negotiation        | Simple `apiVersion: 1` field?              |
| Telemetry format           | OpenTelemetry integration plugin?          |

## 17. Immediate Next Steps

1. Implement `ServiceRegistry` (no external exposure yet)
2. Add feature flag & skeleton `PluginManager`
3. Port Performance plugin as reference
4. Add ADR file referencing this plan

## 18. Glossary

- **Plugin**: Module implementing lifecycle & extension contracts
- **Service**: Reusable dependency registered in registry (e.g., Redis client)
- **Middleware**: Function intercepting request pipeline phases
- **Lifecycle**: Structured phases controlling app readiness & shutdown

---

Draft prepared: 2025-10-04. Update this document as phases land.
