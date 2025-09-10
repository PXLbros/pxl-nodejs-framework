# PXL Node.js Framework – Enhancement & Modernization Plan

_Last reviewed: 2025-09-10_

This document catalogs architectural, code-quality, performance, security, and DX (developer experience) improvement opportunities identified in the current codebase. Items are grouped by priority and theme. Each entry includes: Rationale, Recommended Action, Effort (S/M/L/XL), and Risk (Lo/Med/Hi). Where valuable, suggested implementation patterns are included.

---

## Priority Legend

- P0 – Critical / foundational (address soon; impacts stability/security)
- P1 – High value (unlocks productivity / reduces defects)
- P2 – Medium (incremental quality & maintainability)
- P3 – Low / polish / opportunistic

Effort (E): S (<0.5d), M (0.5–2d), L (2–5d), XL (epic)

---

## Executive Summary

The framework offers a cohesive abstraction over Fastify, Redis, Queues, Events, Database (MikroORM), and Performance Monitoring. Core challenges: (1) God-object orchestration (`BaseApplication`), (2) inconsistent error & lifecycle handling (direct `process.exit`), (3) weak configuration validation, (4) dynamic loading patterns with minimal type safety, (5) inconsistent logging & duplicated concerns, (6) missing operational safeguards (rate limiting, security headers), (7) cluster reliance (Node.js Cluster deprecation trajectory), (8) custom deep merge & reflection-heavy access patterns, (9) limited test scaffolding & observable quality gates, (10) runtime assumptions (very large body limits, long timeouts) increasing risk.

Focus areas:

1. Stabilize lifecycle & shutdown semantics
2. Introduce strongly typed config + validation + dependency injection boundaries
3. Formalize plugin/module system (application capabilities as opt‑in providers)
4. Harden web layer (security, rate limiting, input validation, schema-driven controllers)
5. Improve observability (structured logs, correlation IDs, metrics exposure)
6. Reduce custom utilities where mature OSS solutions exist
7. Prepare for future Node evolutions (workers vs cluster)

---

## P0 / Critical

Status Legend: ✅ Done | 🚧 In Progress | 📅 Planned / Not Started

### 1. Lifecycle & Shutdown Refactor – ✅ Done (initial implementation)

- Issue: `BaseApplication` directly calls `process.exit()` across multiple error and signal paths. This impairs testability (hard to assert soft-fail states), increases risk of partial shutdown (unflushed logs, hanging DB/Redis/queue connections, uncleared `setInterval`), and complicates embedding the framework inside larger hosts.
- Action: Eliminate in-framework `process.exit()` calls. Application code returns an `ExitOutcome` (code + reason) to a single responsibility launcher (e.g. `bin/pxl`), which performs the actual `process.exit(code)` after a graceful, timeout‑bounded teardown. Introduce a `LifecycleManager` to register and orchestrate startup/shutdown hooks & disposables (timers, intervals, sockets, external clients). Provide structured phases and idempotent stop semantics.
- Implementation (Detailed):
  1. Types
  - `type ExitCode = 0 | 1 | 2 | 130 | 137 | 143` (curated common codes: success, generic error, config error, SIGINT, OOM/Kill, SIGTERM).
  - `interface ExitOutcome { code: ExitCode; reason: string; error?: unknown }`.
  - `interface Disposable { dispose(): Promise<void> | void }`.
  2. Lifecycle Manager (`src/lifecycle/lifecycle-manager.ts`)
  - Phases: `created -> initializing -> starting -> running -> stopping -> stopped` (exposed as readonly state).
  - Registration APIs:
  - `onInit(fn)`, `onStart(fn)`, `onReady(fn)` (optional barrier), `onShutdown(fn)`, `onBeforeShutdown(fn)` (reverse execution order for teardown).
  - `trackDisposable(d: Disposable | { dispose: Function })` and helpers: `trackTimeout(id: NodeJS.Timeout)`, `trackInterval(id: NodeJS.Timeout)` which wrap & auto-clear on shutdown.
  - Guarantees: Each hook called at most once; errors aggregated then logged; failure to shutdown within configurable timeout (default 10s) escalates to forced exit code (e.g. 1 or 137 if signal).
  3. Shutdown Controller (`ShutdownController`)
  - Thin facade exposing `register(fn: () => Promise<void>|void)` (alias of `onShutdown`) plus `initiate(reason, signal?)`.
  - Maintains internal `isShuttingDown` flag to coalesce concurrent signals.
  4. Signal Handling (in launcher only)
  - Listen for `SIGINT`, `SIGTERM`, optionally `SIGHUP`.
  - On first signal: log intent, call `app.stop({ reason: 'signal:SIGTERM', signal: 'SIGTERM' })`.
  - On second signal before completion: log warning and `process.exit(130)` (hard abort).
  5. Removing Direct Exits
  - Replace `process.exit(n)` in framework with either: (a) throw `FrameworkFatalError` caught by launcher, or (b) return `ExitOutcome` from `start()` / `run()` promise rejection pathway.
  6. Timeout Boundaries
  - Config: `gracefulShutdown: { timeoutMs: number }` (default 10000) — if exceeded, log pending disposables and exit with code 1.
  7. Logging & Ordering
  - Execute `onBeforeShutdown` in registration order (oldest -> newest) for pre-stop notifications; execute `onShutdown` in reverse (LIFO) to mirror resource acquisition order.
  8. Test Strategy
  - Unit: Mock lifecycles; assert hook invocation order & idempotency.
  - Integration: Start minimal app, register artificial interval + mock DB client; trigger `initiate()`; assert interval cleared & dispose called.
  - Failure Path: Register a hanging hook; assert timeout triggers forced outcome & logs unresolved handles.
  9. Migration Notes
  - Remove all `process.exit` occurrences (grep: `process\.exit`).
  - Update bin entry (`pxl.js` / `bin/console.ts`) to wrap main in try/catch returning `ExitOutcome`.
  - Provide deprecation notice in changelog referencing old behavior.
  10. Example (Conceptual)

  ```ts
  const lifecycle = new LifecycleManager();
  lifecycle.onShutdown(async () => db.close());
  lifecycle.trackInterval(setInterval(pulseMetrics, 5000));
  process.on('SIGTERM', () => lifecycle.initiate('signal:SIGTERM'));
  ```

  11. Edge Cases Covered
  - Multiple signals; repeated `initiate()` calls; hook throwing sync vs async errors; long‑running hook timeout; disposal order correctness.
  12. Deliverables
  - New lifecycle module + tests.
  - Refactored `BaseApplication` to delegate shutdown.
  - Updated docs: lifecycle phases diagram & embedding guide.

  (If scope grows, consider follow-up: a plugin API leveraging the same lifecycle hooks.)

- Current Status: `LifecycleManager`, `ShutdownController`, exit handler utilities, hook phases, disposables tracking, timeout logic, and tests are implemented (`src/lifecycle/*`). Direct `process.exit` calls have been removed from core runtime except in launcher/test contexts. Further polish: aggregate error reporting formatting & documenting embedding pattern in docs (follow-up pending).
- Effort: M | Risk: Med (behavioral change around shutdown ordering; requires thorough migration note)

### 2. Configuration Validation & Type Safety – 📅 Planned

- Issue: Commented-out Joi schema; runtime assumptions; unvalidated nested options.
- Action: Adopt Zod (better TS inference) or retain Joi with explicit schemas + `infer` types. Fail-fast at startup with aggregated error report.
- Current Status: No Zod/Joi schema enforcement present yet (search shows only conceptual references). Needs schema module + startup fail-fast.
- Effort: M | Risk: Lo

### 3. Security Hardening (HTTP) – 📅 Planned

- Issue: No rate limiting, missing security headers (helmet), permissive 5GB body limit, long 30m connection timeout, wildcard CORS pattern turning `*` into `true` (credential ambiguity).
- Action: Add configurable sane defaults: bodyLimit <= 25MB (override via config), adopt `@fastify/helmet`, `@fastify/rate-limit`, expose security config section.
- Current Status: Large defaults still present (5GB bodyLimit, 30m connectionTimeout). No `@fastify/helmet` or rate limiting integration detected. CORS wildcard logic remains simplistic.
- Effort: M | Risk: Med

### 4. Cluster Strategy Modernization – 📅 Planned

- Issue: Depends on built‑in `cluster`; Node direction favors `worker_threads` or external process managers (e.g., systemd/PM2). Future deprecation risk.
- Action: Abstract concurrency layer behind `ProcessStrategy` interface (e.g., `SingleProcessStrategy`, `WorkerPoolStrategy`). Allow pluggable scaling.
- Current Status: Existing `cluster` usage and `ClusterManager` remain; no abstraction layer introduced yet.
- Effort: L | Risk: Med

### 5. Unified Error Handling & Logging – 🚧 In Progress

- Issue: Mixed `console.error` vs `Logger.error`; double Sentry capture possible (`error()` + custom format). Incomplete context propagation.
- Action: Central error pipeline -> `ErrorReporter` (normalizes shape: message, code, cause, severity, context). Single Sentry interface.
- Current Status: Central logger abstraction in place, but mixed `console` vs `Logger` largely addressed; still lacks normalized error envelope & correlation. Work to introduce `ErrorReporter` pending.
- Effort: M | Risk: Med

### 6. Input Validation & Route Typing – 📅 Planned

- Issue: Dynamic controller/action resolution with `any`; validation uses `request.compileValidationSchema` (non-standard) => unclear integration with Fastify’s native AJV.
- Action: Generate JSON Schemas (Zod -> JSON) for routes; use Fastify `schema` property (automatically validated). Use typed controller signature: `Controller<ActionParams, Body, Query, Reply>` generics.
- Current Status: Routes dynamically load controllers without schema objects; no Fastify JSON schema integration yet.
- Effort: L | Risk: Med

### 7. Redis Client Duplication – 🚧 In Progress

- Issue: Both `ioredis` and `redis` packages; operational & conceptual redundancy.
- Action: Standardize (recommend `ioredis` for cluster + sentinel). Remove unused package, adjust typings.
- Current Status: Both `ioredis` (for redis manager) and `redis` (inside cache manager) still present. Consolidation not yet completed; plan is to standardize on `ioredis` and adapt `CacheManager` to reuse `RedisManager` instance.
- Effort: S | Risk: Lo

---

## P1 / High

### 8. Break Up `BaseApplication` God Object – 📅 Planned

- Issue: Orchestrates config, cache, database, queue, events, performance, signals.
- Action: Introduce service registration container (DI light): `ApplicationContext` holding providers. Refactor into modules: `ConfigModule`, `CacheModule`, `DatabaseModule`, `MessagingModule`, `MetricsModule`.
- Effort: L | Risk: Med

### 9. Performance Monitor Pluginization – 📅 Planned

- Issue: Side-effect initialization inside constructor; leakage risk (interval not cleared on stop).
- Action: Convert to plugin with explicit `start()` / `stop()` and registration in lifecycle.
- Effort: M | Risk: Lo

### 10. Health & Readiness Probes – � In Progress

- Issue: Single `/health` route; no readiness gate (e.g., DB connected, queues ready) vs liveness (process up).
- Action: Add `/health/live` & `/health/ready` with pluggable probe functions.
- Implementation (In Progress):
  - Introduced lifecycle awareness in web controllers (inject `LifecycleManager`).
  - Added separate controller actions: `live` (always 200 if process not shutting down) and `ready` (aggregates probes: database, redis, queue, event manager; returns 503 until lifecycle phase RUNNING & all mandatory probes pass).
  - Backwards compatibility: legacy `/health` retained (composite readiness style JSON) but will be deprecated in favor of explicit endpoints.
  - Probe registry design: lightweight interface `HealthProbe { name: string; required: boolean; check(): Promise<boolean>; }` planned for next step so modules can self‑register via lifecycle `onInit`.
  - Performance monitoring skip list updated to include new endpoints.
  - Readiness JSON shape draft:
    ```json
    {
      "ready": true,
      "phase": "RUNNING",
      "probes": {
        "database": { "healthy": true, "required": true },
        "redis": { "healthy": true, "required": true },
        "queue": { "healthy": true, "required": false }
      }
    }
    ```
  - Failure returns 503 with `ready: false` and list of failing required probes.
- Current Status: Controller & route refactor underway (code changes in this commit add endpoints & lifecycle injection; probe registry abstraction next).
- Effort: S | Risk: Lo

### 11. Logging Correlation & Structured Metadata – 📅 Planned

- Issue: No request ID / trace correlation; log meta flattening to a string.
- Action: Add request lifecycle hook injecting `request-id` (uuid v7) & propagate via async-local-storage. Use structured JSON logs (retain color for dev).
- Current Status: No AsyncLocalStorage usage or request ID injection implemented yet.
- Effort: M | Risk: Lo

### 12. Replace Custom Deep Merge Utility – 🚧 In Progress

- Issue: `defaultsDeep` reinventing merge, partial array semantics, no type inference.
- Action: Adopt `lodash.merge` or produce strongly typed recursive partial merge with tests. Remove exposure to prototype pollution through library choice.
- Current Status: Custom `defaultsDeep` still used widely (`Helper.defaultsDeep`). Security guard clauses added; replacement with maintained library or typed merge pending.
- Effort: S | Risk: Lo

### 13. Route Definition DSL / File-System Routing Option – 📅 Planned

- Issue: Manual route arrays; risk of inconsistency.
- Action: Optional convention-based routing: files under `controllers/{area}/{verb}.controller.ts` -> auto-scan. Provide explicit vs convention toggle.
- Effort: M | Risk: Lo

### 14. Database Entity Schema Alignment – 📅 Planned

- Issue: Deriving validation from entity’s Joi schema manually; risk of drift.
- Action: Code generation step: entity -> validation + OpenAPI schema. Or unify around a single source (Zod → MikroORM schema generation via metadata adapter).
- Effort: L | Risk: Med

### 15. OpenAPI / API Documentation Generation – 📅 Planned

- Issue: No machine-readable contract.
- Action: Emit OpenAPI spec from Fastify route schemas; serve `/docs/json` + optional Swagger UI in non-production.
- Effort: M | Risk: Lo

### 16. Observability: Metrics & Tracing – 📅 Planned

- Issue: Only logging + internal performance monitor; no Prometheus metrics or distributed tracing.
- Action: Add `@opentelemetry/api` instrumentation (Fastify, Redis, DB). Export metrics endpoint (`/metrics`).
- Effort: L | Risk: Med

---

## P2 / Medium

### 17. Consistent Naming & API Design – 📅 Planned

- Issue: Getter `Name` (PascalCase) vs lowerCamelCase norms; inconsistent `*Manager` patterns.
- Action: Rename to `name`, align managers to `XService` where they encapsulate behavior; keep managers for pooling semantics only.
- Effort: S | Risk: Med (breaking change)

### 18. Time Utilities & High-Resolution Timers – 📅 Planned

- Issue: Manual `process.hrtime()` handling; Node 18+ `performance.now()` simpler.
- Action: Create `Timing` utility exposing `measure(fn)` & durations returning ms with decimals.
- Effort: S | Risk: Lo

### 19. Avoid Over-Broad Public Surface (Barrel Exports) – 📅 Planned

- Issue: `export *` across many modules bloats consumer intellisense / potential accidental API guarantees.
- Action: Curate explicit exports; add internal-only modules in `src/internal`.
- Effort: M | Risk: Med

### 20. Test Strategy & Coverage Gate – 🚧 In Progress

- Issue: Using Node test runner with `--experimental-strip-types`; uncertain coverage enforcement.
- Action: Add coverage threshold (nyc + source maps) or integrate `c8`. Provide unit vs integration separation + contract tests for plugin APIs.
- Current Status: Extensive unit & integration tests exist (not yet enforcing coverage thresholds). Need coverage gate config & reporting improvements.
- Effort: M | Risk: Lo

### 21. Pluggable Queue / Job Middleware – 📅 Planned

- Issue: Queue jobs appear to lack cross-cutting decorators (logging, retry policy normalization, metrics).
- Action: Introduce job pipeline: `before(job)`, `after(job)`, `onError(job, err)`.
- Effort: M | Risk: Lo

### 22. Graceful Startup Barrier – 🚧 In Progress

- Issue: `start()` proceeds after init; no aggregated readiness check to gate external traffic.
- Action: Implement `Promise.allSettled` aggregator & readiness state machine.
- Current Status: Lifecycle phases (`initialize` -> `start` -> `ready`) implemented; readiness gating not yet exposed to external health endpoint.
- Effort: S | Risk: Lo

### 23. Binary / CLI Ergonomics – 📅 Planned

- Issue: `pxl.js` likely bootstrap only; limited developer ergonomics.
- Action: Add subcommands: `pxl dev`, `pxl routes`, `pxl doctor`, `pxl generate entity`.
- Effort: M | Risk: Lo

---

## P3 / Low / Polish

### 24. Body Parsing & Streaming – 📅 Planned

- Lower body limits; encourage streaming for large uploads; add example.

### 25. CORS Configuration Simplification – 📅 Planned

- Accept comma-separated env var; auto-trim; warn on wildcard in production.

### 26. Modular Feature Flags – 📅 Planned

- Expose structured feature flags registry for conditional code paths (observability, heavy instrumentation).

### 27. Developer Onboarding Docs – 📅 Planned

- Expand docs: architecture diagram, lifecycle phases, extension points.

### 28. Release Automation – 📅 Planned

- Add conventional commits + changelog generation (`changesets` or `semantic-release`).

### 29. Example Projects / Templates – 📅 Planned

- Provide minimal starter (API only), full stack, event-driven sample.

### 30. Runtime Validation for Config Mutations – 📅 Planned

- Freeze configuration object post-initialization to prevent accidental mutation.

---

## Architectural Refactor Themes

| Theme         | Current Issue                   | Target State                                | Benefits                |
| ------------- | ------------------------------- | ------------------------------------------- | ----------------------- |
| Lifecycle     | Direct exits, scattered cleanup | Central orchestrator & disposables registry | Testability, resilience |
| Modularity    | God-object                      | DI Container + opt-in modules               | Extensibility           |
| Validation    | Ad hoc                          | Unified schema (Zod) -> types/OpenAPI       | Safety, docs            |
| Observability | Logs only + custom perf         | Tracing + metrics + correlation IDs         | Faster debugging        |
| Security      | Minimal defaults                | Defense-in-depth presets                    | Reduced risk            |
| Concurrency   | Node cluster                    | Strategy abstraction / worker threads       | Future-proof            |

---

## Suggested Implementation Sequencing (Roadmap)

1. (Sprint 1) Config + lifecycle + logging baseline (Items 1,2,5,6 subset) → Establish stable core.
2. (Sprint 2) Security + validation + health/readiness (Items 3,10,15).
3. (Sprint 3) DI refactor + module extraction (Item 8) + performance monitor plugin (9).
4. (Sprint 4) Observability (16,11) + metrics/tracing.
5. (Sprint 5) Cluster strategy abstraction (4) + Redis consolidation (7) + route DSL (13).
6. (Sprint 6+) Remaining medium polish (17–23) then low-priority backlog.

---

## Quick Wins (High ROI / Low Effort)

- Remove duplicate Redis library (7)
- Standardize logging calls (5)
- Add Zod config schema (2)
- Add basic security headers + reduce body limit (3)
- Add request ID with ALS (11)

---

## Risk Notes

- Breaking changes (naming, exports) require semver major (17,19).
- DI & modularization (8) may shift initialization order; create migration guide.
- Replacing cluster (4) can impact deployment scripts (document clearly).

---

## Open Questions / Clarifications Needed

- Are there consumers relying on current barrel exports implicitly? (Affects 19)
- Expected multi-tenancy or single-tenant runtime? (Influences config scoping)
- Planned distributed deployment (k8s)? (Impacts readiness/liveness detail)

---

## Metrics of Success

| Goal          | Metric                           | Baseline | Target                   |
| ------------- | -------------------------------- | -------- | ------------------------ |
| Stability     | Unhandled rejections per 7d      | Unknown  | Zero (captured & logged) |
| Observability | % routes with schema             | <20%     | 100%                     |
| Security      | High severity Snyk issues        | TBD      | 0                        |
| DX            | Avg new service bootstrap (mins) | >30      | <5                       |
| Test Quality  | Coverage (lines)                 | Unknown  | ≥80% core modules        |

---

## Appendices

### A. Example Config Schema (Conceptual)

(Zod sketch – not final API)

```ts
const FrameworkConfig = z.object({
  name: z.string(),
  instanceId: z.string().default(() => randomUUID()),
  redis: z.object({ host: z.string(), port: z.number().int(), password: z.string().optional() }),
  database: z
    .object({
      enabled: z.boolean(),
      host: z.string(),
      port: z.number().int(),
      username: z.string(),
      password: z.string(),
      databaseName: z.string(),
      entitiesDirectory: z.string().optional(),
    })
    .partial({ entitiesDirectory: true })
    .optional(),
  web: z.object({ host: z.string().default('0.0.0.0'), port: z.number().int().default(3001) }),
  security: z.object({
    rateLimit: z.object({
      enabled: z.boolean().default(true),
      max: z.number().default(1000),
      intervalMs: z.number().default(60000),
    }),
  }),
});
```

### B. Request Correlation (Conceptual)

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
const als = new AsyncLocalStorage<{ requestId: string }>();
fastify.addHook('onRequest', (req, _r, done) => {
  als.run({ requestId: crypto.randomUUID() }, done);
});
// Logger enhancement reads from ALS if present.
```

---

## Summary

Addressing P0/P1 items positions the framework as a production-grade, extensible platform with clear contracts, safer defaults, and strong observability. Subsequent P2/P3 items refine ergonomics and polish. This plan should be revisited quarterly to incorporate emerging needs and feedback from early adopters.
