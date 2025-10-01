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
npm run example:install

# Run backend + frontend together with hot-reload
npm run example:hello-world
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
npm run example:commands:install

# Run commands
npm run example:commands:hello
npm run example:commands:seed
npm run example:commands:queue
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

## Running Examples

### From Repository Root (Recommended)

The easiest way to run examples is from the repository root:

```bash
# Install all example dependencies (one-time setup)
npm run example:install

# Hello World Example
npm run example:hello-world              # Backend + frontend with hot-reload
npm run example:hello-world:backend      # Backend only
npm run example:hello-world:frontend     # Frontend only

# Commands Example
npm run example:commands:install         # Install commands example dependencies
npm run example:commands:hello           # Run hello command
npm run example:commands:seed            # Run database-seed command
npm run example:commands:queue           # Run queue-process command
```

**Features:**

- ✅ Single command to start both backend and frontend
- ✅ Color-coded output (blue for backend, magenta for frontend)
- ✅ Hot-reload enabled for both
- ✅ Framework source changes picked up instantly

### Manual Setup

You can also run examples individually:

```bash
cd examples/hello-world/backend
npm install
npm run dev
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
