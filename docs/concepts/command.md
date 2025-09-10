# Commands (CLI)

Lightweight command manager built on `yargs` to add custom CLI behaviors.

## Defining

```ts
import { CommandManager } from '@scpxl/nodejs-framework/command';

const commandManager = new CommandManager();
  .addCommand({
    command: 'greet <name>',
    description: 'Greets a user',
    builder: y => y.positional('name', { type: 'string' }),
    handler: argv => console.log(`Hello ${argv.name}`)
  })
  .addOption({ option: 'verbose', description: 'Extra output', type: 'boolean' });

commandManager.parse();
```

## Options

Global options added via `addOption` appear on all commands.

## Recommendations

- Keep command handlers small—delegate to services.
- Use CI scripts via the CLI for shared tooling.
