# Changelog

All notable changes to the PXL Node.js Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.19] - 2025-10-01

This is a major release featuring significant improvements to error handling, testing infrastructure, example applications, and overall framework robustness. The release includes 98 files changed with 16,518 insertions and 2,803 deletions.

### Added

#### Examples & Documentation

- **Complete Hello World Example Application**
  - Full-stack example with Vue 3 + TypeScript frontend
  - Backend with WebSocket support for real-time greetings
  - Database integration with CRUD operations for greetings
  - API health checks and environment information endpoints
  - Vite configuration with API proxy support

- **CLI Commands Example Application**
  - `hello` command demonstrating basic CLI functionality with argument parsing and colored output
  - `database-seed` command for seeding databases with sample data, including error handling and progress indication
  - `queue-process` command showcasing queue/job processing with job creation and monitoring
  - Main application entry point with command manager setup and graceful shutdown handling

- **Comprehensive Documentation**
  - Added detailed README files for all example applications
  - Created examples/README.md with overview of all examples
  - Added implementation status documentation for hello-world example

#### Error Handling Framework

- **Framework-Specific Error Classes**
  - `FrameworkError` base class for all framework-specific errors
  - `ConfigurationError` for configuration-related issues
  - `ValidationError` for data validation failures
  - `DatabaseError` for database operation failures
  - `RedisError` for Redis connection/operation issues
  - `QueueError` for queue system problems
  - `WebServerError` for web server issues
  - `WebSocketError` for WebSocket connection problems
  - `LifecycleError` for application lifecycle issues
  - `ResourceNotFoundError` for missing resources
  - `NotImplementedError` for unimplemented features
  - All error classes support custom context and severity levels

- **Error Reporting System**
  - `ErrorReporter` class for normalized error handling
  - Error normalization with context propagation
  - Severity mapping and error categorization
  - Integration with logging system

#### Request Context Management

- **Request Context System**
  - `RequestContext` interface for request traceability
  - Functions for managing request context: `getRequestContext`, `getRequestId`, `setUserId`, `getContextMetadata`, `setContextMetadata`
  - Synchronous and asynchronous context execution: `runWithContext`, `runWithContextAsync`
  - Context isolation across concurrent executions
  - Exported as `@scpxl/nodejs-framework/request-context`

#### Redis Improvements

- **In-Memory Redis Client**
  - Complete in-memory Redis implementation for testing and development
  - Support for basic operations: GET, SET, DEL, EXISTS, EXPIRE, TTL
  - Pub/Sub functionality with channel subscriptions
  - Hash operations: HGET, HSET, HGETALL, HDEL, HEXISTS
  - List operations: LPUSH, RPUSH, LPOP, RPOP, LRANGE
  - Set operations: SADD, SREM, SMEMBERS, SISMEMBER
  - Key pattern matching with KEYS command
  - TTL-based automatic expiration

#### WebSocket Enhancements

- **Enhanced WebSocketRouteSchema**
  - Added required fields for `type`, `controllerName`, and `action`
  - Improved type safety for WebSocket route definitions
  - Better validation for WebSocket endpoints

#### Configuration Options

- **WebServer Configuration**
  - Added `bodyLimit` property for request body size limits
  - Added `connectionTimeout` property for connection timeout configuration
  - Enhanced WebServerConfig interface with additional options

### Changed

#### API Requester Refactoring

- **Migration from Axios to Native Fetch API**
  - Replaced Axios with native fetch for all HTTP requests
  - New `ApiRequestConfig` interface for request configuration
  - Updated return types from `AxiosResponse<T>` to `ApiResponse<T>`
  - Enhanced error handling with status and parsed response payloads
  - Support for headers, params, and responseType configuration
  - Updated documentation for new usage patterns

#### Connection Management

- **Enhanced Connection Monitoring**
  - DatabaseManager now uses `CachePerformanceWrapper` for connection tracking
  - RedisManager enhanced with connection monitoring via `CachePerformanceWrapper`
  - Improved connection readiness handling for all Redis clients
  - Prevention of race conditions in Redis connection setup

#### File Operations

- **Asynchronous File Operations**
  - Replaced synchronous file existence checks with asynchronous alternatives
  - Updated CommandApplication to use async file operations
  - Updated EventManager to use async file checks
  - Updated QueueManager to use async file operations
  - Updated RedisManager with async directory checks
  - New File utility methods for async operations in `util/file.ts`
  - AWS S3 service enhanced with async directory checks and file existence verification

#### Memory Management

- **LRU Cache Implementation**
  - Refactored module caching to use LRUCache for improved memory management
  - Enhanced Loader utility with LRU-based caching
  - Better memory efficiency for long-running applications

#### Lifecycle Management

- **AbortController Tracking**
  - Implemented AbortController tracking in LifecycleManager
  - Added AbortController management in WebSocketServer
  - Proper cleanup of controllers during shutdown
  - Enhanced graceful shutdown handling

#### Environment Configuration

- **Standardized NODE_ENV Values**
  - Updated helper functions to use standard NODE_ENV values
  - Consistent environment detection across the framework

### Improved

#### Performance

- **Cache Performance Monitoring**
  - Added performance monitoring wrapper for cache operations
  - Better visibility into cache hit/miss rates
  - Performance metrics for connection pooling

#### Logging

- **Enhanced Logger**
  - Added support for additional log metadata
  - Improved error logging with context

#### Application Architecture

- **Modularity Improvements**
  - Added MODULARITY.md with analysis and recommendations
  - Better separation of concerns
  - Reduced coupling between components

### Testing

#### Comprehensive Test Suite

- **Unit Tests Added**
  - ApiRequester test suite with GET, POST, and error scenarios
  - JWT authentication tests
  - Image utility tests (extractMimeType, mimeTypeToExtension)
  - Loader utility tests (module loading, cache management)
  - BaseController tests (response handling, JWT authentication)
  - HealthController tests (health check responses based on lifecycle status)
  - WebServer tests (initialization, route definition, server lifecycle)
  - Error reporter tests (error normalization, context propagation)
  - Request context tests (context retrieval, metadata handling, isolation)
  - Helper utility tests (deep merging, value retrieval, prototype pollution protection)
  - Event manager tests
  - Cache performance tests
  - Base processor tests for queue system
  - Worker tests for background job processing
  - Redis instance tests
  - AWS S3 service tests
  - WebSocket server tests
  - Lifecycle manager tests with AbortController management

- **Integration Tests Added**
  - Hello-world example integration tests
  - Database integration tests with CRUD operations
  - Lifecycle exports tests enhanced
  - Implementation status tracking for test coverage

- **Test Infrastructure**
  - Enhanced test helpers in `test/utils/helpers/`
  - Improved mocking utilities for database, Redis, and queue systems
  - Better test isolation and cleanup

### Dependencies

#### Removed

- **Axios** - Replaced with native fetch API
- **sharp** - Removed from package.json

#### Updated

- Package dependencies updated to latest compatible versions
- DevDependencies updated for improved development experience

### Fixed

- Redis connection race conditions resolved
- File operation synchronization issues fixed
- Memory leaks in module caching addressed
- AbortController cleanup during shutdown
- WebSocket connection stability improvements

### Documentation

- Added MODULARITY.md for architectural guidance
- Added CLAUDE_OPTIMIZATIONS_FIXES.md for code quality auditing
- Enhanced API Requester documentation in `docs/concepts/api-requester.md`
- Updated README.md with new features and examples
- Added comprehensive example documentation

---

## Previous Releases

### [1.0.18] and earlier

Please refer to git history for changes in versions prior to 1.0.19.
