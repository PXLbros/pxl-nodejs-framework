# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the PXL Node.js Framework - a comprehensive framework for building Node.js applications with support for web servers, databases, queues, caching, and more. It's published as `@pxl/nodejs-framework` on npm.

## Build and Development Commands

### Development

- `npm run dev` - Start development server with nodemon
- `npm run dev:new` - Start development server using the CLI (`node pxl serve`)

### Building

- `npm run build` - Clean and build for production
- `npm run build:local` - Build and publish to yalc for local development
- `npm run clean` - Clean the dist directory

### Documentation

- `npm run docs` - Generate TypeDoc documentation

### Testing

- `npm run test` - Run tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests only

### Local Development with Yalc

- `yalc publish` - Publish library locally
- `yalc add @pxl/nodejs-framework` - Add to consuming project

### Release Management

- `npm run release -- --patch` - Patch version bump
- `npm run release -- --minor` - Minor version bump
- `npm run release -- --major` - Major version bump
- `npm run release -- --version X.Y.Z` - Set specific version
- `npm run release -- --dry-run` - Preview release without making changes

## Code Architecture

### Core Application Types

The framework supports three main application types:

1. **BaseApplication** (`src/application/base-application.ts`) - Abstract base class that handles:
   - Redis connection management
   - Database connection (MikroORM with PostgreSQL)
   - Queue management (BullMQ)
   - Event management
   - Cluster support
   - Graceful shutdown handling

2. **WebApplication** - Extends BaseApplication with Fastify web server
3. **CommandApplication** - Extends BaseApplication for CLI commands

### Key Components

#### Database Layer

- **MikroORM** integration with PostgreSQL
- **DatabaseManager** (`src/database/manager.ts`) - Handles ORM initialization and connection pooling
- **DatabaseInstance** - Individual database connection wrapper
- Entities expected in `src/database/entities/` directory

#### Web Server (Fastify)

- **WebServer** (`src/webserver/webserver.ts`) - Fastify-based HTTP server
- **Controllers** - Base controller classes in `src/webserver/controller/`
- **Routes** - Support for both manual routes and auto-generated entity routes
- CORS, multipart uploads, and request logging built-in

#### Queue System (BullMQ)

- **QueueManager** (`src/queue/manager.ts`) - Redis-backed job queue management
- **Processors** - Job processors expected in designated directory
- **Workers** - Background job processing

#### Caching & Redis

- **RedisManager** (`src/redis/manager.ts`) - Redis connection management
- **CacheManager** (`src/cache/manager.ts`) - High-level caching abstraction

#### WebSocket Support

- **WebSocketServer** - Real-time communication support
- **WebSocketClient** - Client-side WebSocket wrapper
- Room-based message routing

#### Additional Services

- **Email** - Multiple providers (SendGrid, Gmail, SMTP)
- **AWS S3** - File storage integration
- **Authentication** - JWT-based auth system
- **Logging** - Winston-based structured logging
- **Utilities** - File, image, string, time, and URL helpers

### Configuration Structure

Applications are configured through an `ApplicationConfig` object that includes:

- Database connection details
- Redis configuration
- Queue settings
- Web server options
- Cluster configuration
- Event system setup

### Module System

- ES modules with `.js` extensions in imports
- TypeScript compilation target: ESNext
- Modular architecture with index.js barrel exports
- Dynamic module loading support via `Loader` utility

## Development Notes

### Testing

- **Vitest** - Modern testing framework with TypeScript support
- **Coverage**: V8 coverage provider with 80% thresholds
- **Test structure**: Unit tests in `test/unit/`, integration tests in `test/integration/`, E2E tests in `test/e2e/`
- **Mocks**: Database, Redis, and Queue mocks available in `test/utils/mocks/`
- **Helpers**: Test utilities in `test/utils/helpers/`
- Use `npm run build` to verify TypeScript compilation

### TypeScript Configuration

- Strict mode enabled
- Experimental decorators for database entities
- Declaration files generated in dist/

### File Structure

- `src/` - Source code
- `dist/` - Compiled output (gitignored)
- `bin/` - CLI executable
- `pxl.js` - Main CLI entry point
