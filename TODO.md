# PXL Node.js Framework - TODO

This document tracks planned improvements, features, and technical debt for the framework.

## Priority Legend

- 🔴 **P0 - Critical**: Security, stability, or breaking issues
- 🟠 **P1 - High**: Important features or significant improvements
- 🟡 **P2 - Medium**: Quality of life improvements
- 🟢 **P3 - Low**: Nice-to-have features or polish

---

## 🔴 P0 - Critical Priority

### Security Hardening (HTTP)

**Status**: Planned
**Issue**: Large defaults (5GB bodyLimit, 30m connectionTimeout), missing rate limiting by default
**Action**:

- Add configurable sane defaults: bodyLimit <= 25MB (override via config)
- Document `@fastify/helmet` and `@fastify/rate-limit` usage in examples
- Review CORS wildcard logic for credential handling

**Effort**: Medium | **Risk**: Medium

### Cluster Strategy Modernization

**Status**: Planned
**Issue**: Dependency on built-in `cluster`; Node.js direction favors `worker_threads` or external process managers
**Action**:

- Abstract concurrency layer behind `ProcessStrategy` interface
- Support `SingleProcessStrategy`, `WorkerPoolStrategy`
- Allow pluggable scaling approaches

**Effort**: Large | **Risk**: Medium

---

## 🟠 P1 - High Priority

### Input Validation & Route Typing

**Status**: ✅ **Completed** (v1.0.23)
**Completed Features**:

- ✅ Zod schema validation with `fastify-type-provider-zod`
- ✅ Full TypeScript type inference for request/response
- ✅ `defineRoute()` and `defineAction()` helpers
- ✅ Automatic request validation (params, query, body, headers)
- ✅ Response serialization support
- ✅ 100% test coverage for typed routes

**Remaining Work** (Lower Priority):

- Create `src/schemas/common.ts` with reusable schemas (pagination, IDs, responses)
- Replace Joi with Zod in `DynamicEntity` for consistency
- Add OpenAPI/Swagger generation from Zod schemas

**Completed**: October 2025

### Unified Error Handling & Logging

**Status**: In Progress
**Issue**: Mixed `console.error` vs `Logger.error`, double Sentry capture possible
**Action**:

- Create central error pipeline → `ErrorReporter`
- Normalize error shape: message, code, cause, severity, context
- Single Sentry integration point
- Correlation ID propagation

**Effort**: Medium | **Risk**: Medium

### Break Up BaseApplication God Object

**Status**: Planned
**Recommendation**: Start with lightweight approach, not full DI container
**Options**:

1. **Factory Pattern** ⭐ (Recommended first step)
   - Extract initialization logic to `ApplicationFactory`
   - Zero breaking changes
   - Reduces boilerplate in BaseApplication constructor

2. **Plugin Architecture** ⭐ (Best for extensibility)
   - Expand existing `PerformanceMonitorPlugin` pattern
   - Make services truly optional
   - Users can add custom plugins

3. **Builder Pattern** (Convenience layer)
   - Add optional builder without changing core
   - Fluent API for those who want it

**Decision**: Avoid full DI container (over-engineered for ~15 services). Use factory + plugin approach.

**Effort**: Large | **Risk**: Medium

### OpenAPI / API Documentation Generation

**Status**: Planned
**Action**:

- Emit OpenAPI spec from Fastify route schemas
- Serve `/docs/json` + optional Swagger UI in development
- Auto-generate from Zod schemas

**Dependencies**: Requires Route Typing to be completed first
**Effort**: Medium | **Risk**: Low

### Observability: Metrics & Tracing

**Status**: Planned
**Issue**: Only logging + internal performance monitor; no Prometheus metrics or distributed tracing
**Action**:

- Add `@opentelemetry/api` instrumentation (Fastify, Redis, DB)
- Export metrics endpoint (`/metrics`)
- Add connection/request duration metrics
- Integrate with Prometheus/Grafana

**Effort**: Large | **Risk**: Medium

---

## 🟡 P2 - Medium Priority

### Package Upgrades

**Status**: Planned
**Critical upgrades needed**:

1. **Redis**: 4.x → 5.x (breaking changes in SCAN commands, connection API)
2. **Sentry**: 8.x → 9.x (deprecated Hub APIs, new trace sampling)
3. **@types/node**: 22.x → 24.x (Node.js 24.x type definitions)
4. **dotenv**: 16.x → 17.x (`quiet` now defaults to `false`)
5. **Yargs**: 17.x → 18.x (minimum Node 20.19/22.12, singleton removal)
6. **TypeScript**: 5.6.x → 5.8.x (stricter checking, JSON import assertions)

**Approach**: Staged rollout by risk level
**Effort**: 8-12 hours including testing

### Logging Correlation & Structured Metadata

**Status**: Planned
**Issue**: No request ID / trace correlation; log meta flattening to string
**Action**:

- Add request lifecycle hook injecting `request-id` (uuid v7)
- Propagate via AsyncLocalStorage
- Use structured JSON logs (retain color for dev)

**Effort**: Medium | **Risk**: Low

### Replace Custom Deep Merge Utility

**Status**: In Progress
**Issue**: `defaultsDeep` reinventing merge, partial array semantics, no type inference
**Action**:

- Adopt `lodash.merge` or produce strongly typed recursive partial merge
- Remove exposure to prototype pollution
- Add comprehensive tests

**Effort**: Small | **Risk**: Low

### Route Definition DSL / File-System Routing Option

**Status**: Planned
**Issue**: Manual route arrays; risk of inconsistency
**Action**:

- Optional convention-based routing
- Files under `controllers/{area}/{verb}.controller.ts` → auto-scan
- Provide explicit vs convention toggle

**Effort**: Medium | **Risk**: Low

### Graceful Startup Barrier Improvements

**Status**: Completed (basic implementation)
**Follow-up**:

- Expose per-module opt-in readiness registration helpers
- Better error aggregation and reporting
- Timeout configuration for individual probes

**Effort**: Small | **Risk**: Low

### Binary / CLI Ergonomics

**Status**: Planned
**Issue**: `pxl.js` is basic bootstrap only
**Action**:

- Add subcommands: `pxl dev`, `pxl routes`, `pxl doctor`, `pxl generate entity`
- Improve help text and documentation
- Add interactive scaffolding

**Effort**: Medium | **Risk**: Low

---

## 🟢 P3 - Low Priority / Polish

### Body Parsing & Streaming

**Action**:

- Lower default body limits
- Encourage streaming for large uploads
- Add streaming upload example

### CORS Configuration Simplification

**Action**:

- Accept comma-separated env var
- Auto-trim whitespace
- Warn on wildcard in production

### Modular Feature Flags

**Action**:

- Expose structured feature flags registry
- Enable conditional code paths (observability, heavy instrumentation)

### Developer Onboarding Docs

**Action**:

- Expand docs: architecture diagram, lifecycle phases
- Document extension points
- Add migration guides

### Release Automation

**Action**:

- Add conventional commits
- Changelog generation (`changesets` or `semantic-release`)
- Automate npm publishing

### Example Projects / Templates

**Status**: In Progress
**Completed**:

- `examples/hello-world` with Vue 3 frontend + WebSocket
- `examples/commands` with CLI examples

**Next**:

- Document how to bootstrap custom services
- Add queue/event-driven sample
- Provide TypeScript SDK scaffolding

### Runtime Validation for Config Mutations

**Action**:

- Freeze configuration object post-initialization
- Prevent accidental mutation

---

## Testing Priorities

### Coverage Goals

**Current**: ~80% threshold enforced
**Target**:

- **Unit tests**: 90%+ line coverage
- **Integration tests**: Critical path coverage
- **Overall**: 85%+ combined coverage

### Test Infrastructure Improvements

**Needed**:

1. Expand integration test suite for:
   - Database connections under load
   - Redis pub/sub functionality
   - Queue processing workflows
   - WebSocket client-server communication
   - Email service integration (multiple providers)
   - AWS S3 integration

2. Add end-to-end tests for:
   - Application lifecycle (startup/shutdown)
   - Full HTTP request/response cycles
   - Authentication flows
   - CLI command execution

3. Performance testing:
   - Load testing framework
   - Benchmarks for critical paths
   - Memory leak detection

**Timeline**: 6-8 weeks
**Effort**: Large

---

## Completed Items ✅

### Lifecycle & Shutdown Refactor

- ✅ `LifecycleManager` with phases and hooks
- ✅ `ShutdownController` for graceful shutdown
- ✅ Exit handler utilities
- ✅ Removed direct `process.exit` from core runtime

### Configuration Validation & Type Safety

- ✅ Zod-based schema validation
- ✅ Bootstrap-time config enforcement
- ✅ `ConfigValidationError` with friendly formatting

### Performance Monitor Pluginization

- ✅ Converted to plugin with lifecycle hooks
- ✅ Performance wrappers for DB/Queue/Cache
- ✅ Auto-cleanup on shutdown

### Health & Readiness Probes

- ✅ `/health/live` and `/health/ready` endpoints
- ✅ Lifecycle-managed readiness barrier
- ✅ Aggregated probe status

### Redis Client Standardization

- ✅ Removed duplicate `redis` package
- ✅ Standardized on `ioredis`
- ✅ Updated `CacheManager` to use `RedisInstance`

### Time Utilities Modernization

- ✅ New `Timing` class with `performance.now()` API
- ✅ Backward-compatible `Time` utility enhancements
- ✅ Migration from `process.hrtime()` to modern timing

### Security Fixes

- ✅ Prototype pollution protection in utilities
- ✅ Safe object property access patterns
- ✅ Input sanitization in controllers
- ✅ WebSocket client property whitelisting

### Input Validation & Typed Routes (v1.0.23)

- ✅ Integrated `fastify-type-provider-zod` for automatic validation
- ✅ Full TypeScript type inference from Zod schemas
- ✅ `defineRoute()` helper for inline typed handlers
- ✅ `defineAction()` helper for typed controller methods
- ✅ Request validation (params, query, body, headers)
- ✅ Response serialization support
- ✅ Comprehensive test coverage with 11 passing integration tests

---

## Deferred / Won't Do

### Full Service Container / DI System

**Decision**: Over-engineered for framework size (~15 services)
**Alternative**: Use factory pattern + plugin architecture
**Rationale**: Current architecture is solid; focus on refinement over revolution

### Multiple Validation Libraries

**Decision**: Standardize on Zod
**Rationale**: Better TypeScript inference, composability, and ecosystem

---

## Notes

- This document is a living plan. Items may be re-prioritized based on user feedback.
- "In Progress" items have active development or partial implementation.
- See `CLAUDE.md` for development workflow and architecture details.
- See `CHANGELOG.md` for completed features in released versions.
