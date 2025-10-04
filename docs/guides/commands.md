# Commands & CLI

PXL ships with a `pxl` binary (see `package.json` bin) enabling you to build structured operational commands (migrations, seeds, maintenance tasks, queue processors, data exports, etc.).

## Why Commands?

- Encapsulate operational logic (vs ad-hoc scripts)
- Share Application configuration & DI
- Provide consistent logging / error handling / performance instrumentation
- Enable discoverability (`pxl --help`)

## Basic Concept

A command exposes a name, description, optional builder for arguments, and a handler.

## Directory Layout (Suggested)

```
src/
  commands/
    database-seed.command.ts
    queue-process.command.ts
    hello.command.ts
  app.ts (only if reused for shared setup)
```

## Defining a Command

```ts
// src/commands/hello.command.ts
import { defineCommand } from '@scpxl/nodejs-framework/command';

export default defineCommand(({ yargs, app }) => ({
  name: 'hello',
  describe: 'Print greeting',
  builder: yy => yy.option('name', { type: 'string', default: 'world' }),
  handler: async argv => {
    app.logger.info(`Hello ${argv.name}!`);
  },
}));
```

`defineCommand` (pattern) wraps a factory so the framework can lazily construct the Application when needed.

## Application Boot Strategy

For short-lived commands, you often want a minimal subset of modules:

```ts
// src/command-app.ts
import { Application } from '@scpxl/nodejs-framework';

export function createCommandApp() {
  return new Application({
    logger: { level: 'info' },
    database: {
      /* MikroORM config */
    },
    queue: { enabled: true },
  });
}
```

Then inside your command definition you can re-use this creator.

## Queue Worker Command Example

```ts
// src/commands/queue-process.command.ts
import { defineCommand } from '@scpxl/nodejs-framework/command';
import { createCommandApp } from '../command-app';

export default defineCommand(() => ({
  name: 'queue-process',
  describe: 'Start queue workers',
  handler: async () => {
    const app = createCommandApp();
    await app.start();
    app.logger.info('Queue processors running');

    app.queue.process('email:send', async job => {
      // process job
    });

    // Keep process alive until signal
    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig as NodeJS.Signals, () => app.stop()));
  },
}));
```

## Database Seed Command Example

```ts
// src/commands/database-seed.command.ts
import { defineCommand } from '@scpxl/nodejs-framework/command';
import { createCommandApp } from '../command-app';

export default defineCommand(() => ({
  name: 'database-seed',
  describe: 'Seed initial data',
  handler: async () => {
    const app = createCommandApp();
    await app.start();

    const em = app.database.orm.em.fork();
    // ... create entities
    await em.flush();

    await app.stop();
  },
}));
```

## Argument Parsing

The framework integrates with `yargs` (as peer dependency style). Use `builder` to add options / positional args. All parsed args arrive in `handler(argv)`.

## Performance & Logging

Commands gain access to `app.logger` and (if enabled) `PerformanceMonitor`. For long-running batch tasks, consider emitting periodic stats.

## Error Handling Pattern

```ts
try {
  await run();
} catch (err) {
  app.logger.error(err); // or forward to error reporter integration
  process.exitCode = 1;
  await app.stop();
}
```

## Listing Commands

If you structure each command file to default export a definition, you can auto-load a directory (implementation detail may vary based on framework helpers). Provide a `commands` directory path in a future enhancement (planned feature placeholder if not yet implemented).

## Running Commands

```bash
npx pxl hello --name=Dev
npx pxl database-seed
npx pxl queue-process
```

If installed globally or via project scripts, omit `npx`.

## Best Practices

- Keep commands idempotent where possible (especially seeds / migrations)
- Exit with non-zero codes on failure
- Separate long-running worker commands from one-shot tasks
- Avoid loading unnecessary modules (faster startup)
- Log a concise start/finish summary

## Next

- See [Commands concept](/concepts/command)
- Add observability: [Performance Monitoring](/guides/performance-monitoring)
- Deployment: run workers in separate containers/processes

---

Planned: auto-discovery utilities & templated command generator.
