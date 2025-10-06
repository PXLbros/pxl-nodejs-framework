# PXL Framework Examples

This directory contains example projects demonstrating how to use the PXL Node.js Framework.

## Available Examples

### 1. Hello World (`hello-world/`)

A minimal starter example showing the basics:

- **Backend**: Simple PXL WebApplication with ping and hello endpoints (TypeScript)
- **Frontend**: Vite + Vue 3 + TypeScript app consuming the API
- **Imports**: Direct source imports for instant framework updates during development

Perfect for getting started and understanding the framework fundamentals.

**Quick Start (from repository root):**

```bash
# One-time setup: Install dependencies
cd examples/hello-world/backend && npm install
cd ../frontend && npm install

# Run backend only
npm run example --example=hello-world/backend

# Or run backend + frontend together (requires concurrently)
cd examples/hello-world/backend && npm run dev &
cd examples/hello-world/frontend && npm run dev
```

Then open http://localhost:5173 to see the app.

**Alternative (manual):**

```bash
# Backend
cd hello-world/backend
npm install
npm run dev

# Frontend (in another terminal)
cd hello-world/frontend
npm install
npm run dev
```

---

### 2. Commands (`commands/`)

A comprehensive CLI application example using CommandApplication:

- **Modern CLI**: TypeScript-powered command-line application
- **Multiple Commands**: hello, database-seed, queue-process examples
- **Framework Integration**: Redis, Database (MikroORM), Queue (BullMQ) support
- **Best Practices**: 2025 Node.js CLI patterns with colored output and proper error handling

Perfect for building CLI tools, automation scripts, and background jobs.

**Quick Start (from repository root):**

```bash
# One-time setup: Install dependencies
cd examples/commands && npm install

# Run commands
npm run example --example=commands -- hello
npm run example --example=commands -- database-seed
npm run example --example=commands -- queue-process
```

**Alternative (manual):**

```bash
cd commands
npm install
npm run dev hello -- --name "World" --count 3
npm run dev database-seed -- --count 100
npm run dev queue-process -- --action status
```

**See:** `commands/README.md` for detailed documentation and creating custom commands.

---

### 3. Cluster Mode (`cluster/`)

> ⚠️ **DEPRECATION NOTICE**: Cluster mode is legacy. Use container orchestration (Kubernetes, Docker) for production.

A comprehensive example demonstrating Node.js cluster functionality:

- **Auto & Manual Modes**: Scale across all CPUs or specify worker count
- **Load Distribution**: See how requests balance across workers
- **Worker Isolation**: Understand process isolation and memory
- **Shared State**: Cross-worker data sharing via Redis
- **CPU Tasks**: Parallel processing demonstration
- **Crash Recovery**: Automatic worker restart
- **Testing Tools**: Verification and load testing scripts

Perfect for understanding cluster behavior and testing multi-process scaling.

**Quick Start (from repository root):**

```bash
# Install dependencies
cd examples/cluster
npm install

# Run with auto worker mode (one per CPU)
npm run cluster:auto

# Run with manual worker count
npm run cluster:manual

# Verify cluster is working
npm run verify

# Run load test
npm run load-test
```

**See:** `cluster/README.md` for comprehensive documentation, API endpoints, and testing guide.

---

## Running Examples

### From Repository Root (Recommended)

The framework provides a unified `npm run example` command that works with all examples:

```bash
# Generic pattern - runs the default script in any example's package.json
npm run example --example=<path>

# Hello World Example
npm run example --example=hello-world/backend
npm run example --example=hello-world/frontend

# Commands Example - pass additional arguments after --
npm run example --example=commands
npm run example --example=commands -- hello
npm run example --example=commands -- hello --name World --count 3
npm run example --example=commands -- database-seed --count 100
npm run example --example=commands -- queue-process --action status

# Cluster Example
npm run example --example=cluster
npm run example --example=cluster -- --cluster=auto
npm run example --example=cluster -- --cluster=manual --workers=4
```

**Features:**

- ✅ Single unified command pattern for all examples
- ✅ Easy to pass arguments with `--`
- ✅ Works with any example's package.json scripts
- ✅ Framework source changes picked up instantly

**Installation:**

Each example manages its own dependencies. Install them individually:

```bash
cd examples/hello-world/backend && npm install
cd examples/commands && npm install
cd examples/cluster && npm install
```

Or use npm exec to install from root:

```bash
npm exec --prefix examples/hello-world/backend -- npm install
npm exec --prefix examples/commands -- npm install
npm exec --prefix examples/cluster -- npm install
```

### Alternative: Run Directly in Example Directory

You can also run examples by navigating to their directory:

```bash
cd examples/hello-world/backend
npm install
npm run dev
```

Or run specific scripts defined in each example's package.json:

```bash
# Commands example
cd examples/commands
npm run hello              # Run hello command
npm run seed               # Run database-seed
npm run queue              # Run queue-process

# Cluster example
cd examples/cluster
npm run cluster:auto       # Auto worker mode
npm run cluster:manual     # Manual worker count
npm run verify             # Verify cluster
npm run load-test          # Load testing
```

## Import Strategy

The examples import directly from the framework source files:

```typescript
import { WebApplication } from '../../../src/application/web-application.js';
```

**Benefits:**

- ✅ Instant updates when framework source changes
- ✅ No build step needed for the framework
- ✅ Perfect for testing and development
- ✅ Easy to debug into framework code

**Requirements:**

- Uses `tsx` to run TypeScript directly
- Node.js 22+ required (same as framework)

---

## Future Examples

See [EXAMPLES_CODE.md](../EXAMPLES_CODE.md) for planned comprehensive examples:

- `api-basic/` - Full-featured API with database, queues, auth, caching
- `web-vue/` - Complete Vue 3 app with WebSocket, metrics, and real-time updates

---

## Development Tips

1. **Keep examples in sync**: When making framework changes, run examples to catch breaking changes
2. **Minimal dependencies**: Examples should be as simple as possible
3. **Clear documentation**: Each example has its own README with setup instructions
4. **Real-world patterns**: Show best practices and recommended patterns

---

## Contributing

When adding new examples:

1. Follow the existing structure
2. Include a comprehensive README
3. Add `.env.example` for configuration
4. Keep code simple and well-commented
5. Test that it works with both source imports and published package
