# PXL Framework - Command Application Example

A comprehensive example demonstrating how to build modern CLI applications using the PXL Framework's `CommandApplication` class.

## Overview

This example showcases:

- ✅ **CommandApplication** setup and configuration
- ✅ **Multiple command implementations** with different use cases
- ✅ **Command-line argument parsing** using yargs
- ✅ **Framework integrations**: Redis, Database (MikroORM), Queue (BullMQ)
- ✅ **Modern TypeScript patterns** (2025 best practices)
- ✅ **Graceful shutdown** and signal handling
- ✅ **Colored console output** for better UX
- ✅ **Error handling and logging**

## Quick Start

### From Repository Root (Recommended)

```bash
# One-time setup: Install dependencies
npm run example:commands:install

# Run a command
npm run example:commands hello
npm run example:commands hello -- --name "Alice" --count 3
npm run example:commands database-seed
npm run example:commands queue-process -- --action status
```

### Manual Setup

```bash
cd examples/commands

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run commands
npm run hello
npm run hello:name
npm run seed
npm run queue
```

## Available Commands

### 1. **hello** - Simple Greeting Command

A basic command demonstrating argument parsing, options, and colored output.

```bash
# Basic usage
npm run dev hello

# With options
npm run dev hello -- --name "Alice"
npm run dev hello -- --name "Bob" --count 3
npm run dev hello -- --name "World" --uppercase
npm run dev hello -- --name "PXL" --count 5 --uppercase
```

**Options:**

- `--name <string>` - Name to greet (default: "World")
- `--count <number>` - Number of times to greet (default: 1)
- `--uppercase` - Convert greeting to uppercase

**Features:**

- Command-line argument parsing
- Colored console output using picocolors
- Redis integration demonstration
- Framework information display

---

### 2. **database-seed** - Database Integration

Demonstrates database operations with MikroORM.

```bash
# Run seed
npm run dev database-seed

# Clear and seed
npm run dev database-seed -- --clear --count 100
```

**Options:**

- `--clear` - Clear existing data before seeding
- `--count <number>` - Number of records to seed (default: 10)

**Features:**

- Database connection checking
- Entity management patterns
- Transaction support patterns
- Progress indication
- Error handling

**Note:** Requires database configuration in `.env`. See the database configuration section below.

---

### 3. **queue-process** - Queue Management

Shows queue/job processing with BullMQ.

```bash
# Check queue status
npm run dev queue-process

# Add jobs to queue
npm run dev queue-process -- --action add --count 10

# Clear queue
npm run dev queue-process -- --action clear --queue default
```

**Options:**

- `--action <string>` - Action to perform: `status`, `add`, `clear` (default: "status")
- `--queue <string>` - Queue name (default: "default")
- `--count <number>` - Number of jobs to add (default: 5)

**Features:**

- Queue status monitoring
- Job creation
- Queue management
- Redis backend integration

---

## Project Structure

```
examples/commands/
├── README.md                    # This file
├── package.json                 # Dependencies and scripts
├── .env.example                 # Environment configuration template
├── src/
│   ├── index.ts                 # CommandApplication setup
│   └── commands/                # Command implementations
│       ├── hello.ts            # Simple command example
│       ├── database-seed.ts    # Database integration example
│       └── queue-process.ts    # Queue integration example
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Application
APP_NAME=pxl-commands-example
NODE_ENV=development

# Redis (required)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Database (optional - only if using database commands)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=pxl_commands_dev

# Command Options
DEBUG=true
MEASURE_EXECUTION_TIME=true
```

### Database Setup (Optional)

If you want to use database features:

1. **Install PostgreSQL** (if not already installed)

2. **Create database:**

   ```bash
   createdb pxl_commands_dev
   ```

3. **Enable database in config:**

   Uncomment the database configuration section in `src/index.ts`:

   ```typescript
   database: {
     enabled: true,
     host: process.env.DB_HOST || 'localhost',
     port: parseInt(process.env.DB_PORT || '5432', 10),
     username: process.env.DB_USERNAME || 'postgres',
     password: process.env.DB_PASSWORD || 'postgres',
     databaseName: process.env.DB_NAME || 'pxl_commands_dev',
     entitiesDirectory: join(__dirname, 'database', 'entities'),
   }
   ```

4. **Create entities:**

   Create your MikroORM entities in `src/database/entities/`

### Redis Setup

Redis is required for the framework. Make sure Redis is running:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or install locally
# macOS: brew install redis && brew services start redis
# Ubuntu: sudo apt-get install redis-server && sudo systemctl start redis
```

## Creating Custom Commands

### Step 1: Create Command File

Create a new file in `src/commands/`, e.g., `my-command.ts`:

```typescript
import { Command } from '../../../../src/command/index.js';
import type { CommandConstructorParams } from '../../../../src/command/command.interface.js';
import pc from 'picocolors';

export default class MyCommand extends Command {
  public name = 'my-command';
  public description = 'Description of what my command does';

  constructor(params: CommandConstructorParams) {
    super(params);
  }

  public async run(argv?: any): Promise<void> {
    // Extract arguments
    const option = argv?.option || 'default';

    this.log('Command started', { option });

    console.log(pc.cyan('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(pc.cyan('  My Command'));
    console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n'));

    try {
      // Your command logic here
      console.log(pc.green('  ✓ Command executed successfully'));

      // Access framework services
      if (this.redisInstance) {
        const isConnected = await this.redisInstance.isConnected();
        console.log(pc.dim(`  Redis: ${isConnected ? 'Connected' : 'Disconnected'}`));
      }

      if (this.databaseInstance) {
        // Use database
        // const em = this.databaseInstance.getEntityManager();
      }

      if (this.queueManager) {
        // Use queue
        // const queue = this.queueManager.getQueue('my-queue');
      }
    } catch (error) {
      console.log(pc.red('  ✗ Error:'));
      console.log(pc.red(`  ${error instanceof Error ? error.message : String(error)}`));
      throw error;
    }

    console.log(pc.cyan('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n'));
    this.log('Command completed');
  }
}
```

### Step 2: Add Command Options (Optional)

In `src/index.ts`, add options for your command:

```typescript
commandManager.addOption({
  option: 'my-option',
  description: 'Description of my option',
  type: 'string',
});
```

### Step 3: Add npm Script (Optional)

In `package.json`:

```json
{
  "scripts": {
    "my-command": "tsx src/index.ts my-command"
  }
}
```

### Step 4: Run Your Command

```bash
npm run dev my-command -- --my-option value
```

## Modern CLI Best Practices (2025)

This example implements modern Node.js CLI best practices:

1. **TypeScript-First** ✅
   - Full type safety
   - Modern TypeScript 5.x features
   - ESM modules

2. **Developer Experience** ✅
   - Colored output with picocolors (lightweight)
   - Clear error messages
   - Progress indicators
   - Help text generation

3. **Configuration Management** ✅
   - Environment variables via dotenv
   - CLI arguments via yargs
   - Type-safe config validation

4. **Error Handling** ✅
   - Structured error handling
   - Graceful shutdown on errors
   - Proper exit codes

5. **Signal Handling** ✅
   - SIGINT, SIGTERM, SIGHUP support
   - Graceful shutdown
   - Cleanup on exit

6. **Testing-Friendly** ✅
   - Testable command structure
   - Dependency injection
   - Isolated command logic

7. **Performance** ✅
   - Execution time tracking
   - Efficient resource usage
   - Connection pooling

## Available Framework Services

Commands have access to:

- **`this.redisInstance`** - Redis connection
- **`this.databaseInstance`** - MikroORM database instance
- **`this.queueManager`** - BullMQ queue manager
- **`this.applicationConfig`** - Application configuration
- **`this.logger`** - Winston logger
- **`this.log()`** - Command-specific logging helper

## Useful Patterns

### Progress Indication

```typescript
for (let i = 0; i < total; i++) {
  // Do work...
  process.stdout.write(`\r  Progress: ${i + 1}/${total}`);
}
console.log(''); // New line after progress
```

### Error Handling

```typescript
try {
  await someOperation();
  console.log(pc.green('  ✓ Success'));
} catch (error) {
  console.log(pc.red('  ✗ Error:'));
  console.log(pc.red(`  ${error instanceof Error ? error.message : String(error)}`));

  this.logger.error({
    error: error instanceof Error ? error : new Error(String(error)),
    message: 'Operation failed',
  });

  throw error; // Re-throw to exit with error code
}
```

### Redis Operations

```typescript
// Set value
await this.redisInstance.set('key', 'value', 'EX', 3600); // Expires in 1 hour

// Get value
const value = await this.redisInstance.get('key');

// Delete key
await this.redisInstance.del('key');
```

### Database Operations

```typescript
const em = this.databaseInstance.getEntityManager();

// Find entities
const users = await em.find(User, { active: true });

// Create entity
const user = em.create(User, { name: 'Alice', email: 'alice@example.com' });
em.persist(user);
await em.flush();

// Update entity
user.name = 'Alice Updated';
await em.flush();

// Delete entity
em.remove(user);
await em.flush();
```

## Troubleshooting

### Redis Connection Error

```
Error: Redis connection failed
```

**Solution:** Make sure Redis is running:

```bash
docker run -d -p 6379:6379 redis:latest
```

### Database Connection Error

```
Error: Database connection failed
```

**Solution:**

1. Check PostgreSQL is running
2. Verify database credentials in `.env`
3. Ensure database exists: `createdb pxl_commands_dev`

### Command Not Found

```
Warning: Command not found
```

**Solution:**

1. Ensure command file exports default class
2. Check file naming matches command name
3. Verify `commandsDirectory` path in config

## Next Steps

- Add more commands for your use case
- Integrate with external APIs
- Add data validation with Zod
- Implement interactive prompts
- Create command aliases
- Add unit tests for commands

## Resources

- [PXL Framework Documentation](../../README.md)
- [Yargs Documentation](https://yargs.js.org/)
- [MikroORM Documentation](https://mikro-orm.io/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Node.js CLI Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)

## License

See the main framework [LICENSE](../../LICENSE) file.
