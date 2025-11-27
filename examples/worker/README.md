# PXL Framework - Worker Application Example

A comprehensive example demonstrating how to build long-running queue workers using the PXL Framework's `WorkerApplication` class.

## Overview

This example showcases:

- **WorkerApplication** setup and configuration
- **Queue processor** implementation with lifecycle hooks
- **Graceful shutdown** handling
- **Multiple queue support**

## Key Concept: WorkerApplication vs CommandApplication

| Feature       | WorkerApplication             | CommandApplication             |
| ------------- | ----------------------------- | ------------------------------ |
| **Purpose**   | Long-running queue processing | One-shot CLI commands          |
| **Lifecycle** | Runs indefinitely             | Exits after command completes  |
| **Use Case**  | Background job processing     | CLI tools, migrations, scripts |

## Quick Start

### From Repository Root (Recommended)

```bash
# One-time setup: Install dependencies
npm run example:worker:install

# Start the worker (runs indefinitely)
npm run example:worker

# In another terminal, add test jobs
npm run example:worker:add-job
npm run example:worker:add-job -- --count=10
```

### Manual Setup

```bash
cd examples/worker

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start the worker
npm run dev

# In another terminal, add test jobs
npm run add-job
```

## Project Structure

```
examples/worker/
├── README.md                    # This file
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── .env.example                # Environment configuration template
├── src/
│   ├── index.ts                # WorkerApplication setup
│   ├── add-job.ts              # Utility to add test jobs
│   └── processors/             # Job processors
│       └── example-processor.ts # Example processor implementation
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Application
APP_NAME=pxl-worker-example
NODE_ENV=development

# Redis (required)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Database (optional - uncomment to enable)
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=postgres
# DB_PASSWORD=postgres
# DB_NAME=pxl_worker_dev

# JWT (required by framework)
JWT_SECRET=dev-secret-change-in-production-please
```

### Redis Setup

Redis is required for queue processing. Make sure Redis is running:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or install locally
# macOS: brew install redis && brew services start redis
# Ubuntu: sudo apt-get install redis-server && sudo systemctl start redis
```

## Creating Custom Processors

### Step 1: Create Processor File

Create a new file in `src/processors/`, e.g., `my-processor.ts`:

```typescript
import type { Job } from 'bullmq';
import { BaseProcessor } from '../../../../src/queue/index.js';

export default class MyProcessor extends BaseProcessor {
  async process({ job }: { job: Job }): Promise<unknown> {
    const { data } = job.data.payload;

    this.log.info(`Processing job ${job.id}`, { data });

    // Your processing logic here
    const result = await this.doSomething(data);

    return { success: true, result };
  }

  private async doSomething(data: unknown): Promise<unknown> {
    // Implement your logic
    return data;
  }
}
```

### Step 2: Register the Job in Queue Config

In `src/index.ts`, add the job to the queue configuration:

```typescript
queue: {
  processorsDirectory: join(__dirname, 'processors'),
  queues: [
    {
      name: 'default',
      jobs: [
        { id: 'example-processor' },
        { id: 'my-processor' },  // Add your new processor
      ],
    },
  ],
}
```

### Step 3: Add Jobs to the Queue

From your application code or another service:

```typescript
import { Queue } from 'bullmq';

const queue = new Queue('default', { connection: redisConfig });

await queue.add('my-processor', {
  payload: {
    data: 'your job data here',
  },
});
```

## Processor Lifecycle Hooks

`BaseProcessor` provides lifecycle hooks for setup and cleanup:

```typescript
export default class MyProcessor extends BaseProcessor {
  // Called before process()
  async beforeProcess({ job }: { job: Job }): Promise<void> {
    // Setup: fork EntityManager, initialize resources, etc.
    this.log.debug(`Starting job ${job.id}`);
  }

  // Main processing logic
  async process({ job }: { job: Job }): Promise<unknown> {
    return { success: true };
  }

  // Called after process() - ALWAYS runs, even on error
  async afterProcess({ job, result, error }: { job: Job; result?: unknown; error?: Error }): Promise<void> {
    // Cleanup: clear EntityManager, close connections, etc.
    if (error) {
      this.log.error(error, 'Job failed');
    }
  }
}
```

## Database Access in Processors

If you need database access, enable the database config and use `withEntityManager`:

```typescript
export default class DbProcessor extends BaseProcessor {
  async process({ job }: { job: Job }): Promise<unknown> {
    // Automatic EntityManager lifecycle management
    return this.withEntityManager(async em => {
      const user = await em.findOne('User', { id: job.data.payload.userId });
      return { user };
    });
  }
}
```

## Scaling Workers

### Multiple Worker Instances

Run multiple worker processes for horizontal scaling:

```bash
# Terminal 1
INSTANCE_ID=worker-1 npm run dev

# Terminal 2
INSTANCE_ID=worker-2 npm run dev

# Terminal 3
INSTANCE_ID=worker-3 npm run dev
```

### Concurrency Configuration

Control per-worker concurrency in the queue config:

```typescript
queues: [
  {
    name: 'default',
    jobs: [{ id: 'example-processor' }],
    settings: {
      concurrency: 10, // Process up to 10 jobs simultaneously
    },
  },
];
```

## Production Deployment

### Using PM2

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'pxl-worker',
    script: 'dist/index.js',
    instances: 4,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
    },
  }]
};

# Start
pm2 start ecosystem.config.js
```

### Using Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

## Troubleshooting

### Worker Not Processing Jobs

1. Ensure Redis is running and accessible
2. Check that processor file name matches job.id in config
3. Verify processor exports a default class extending BaseProcessor

### Jobs Stuck in Queue

1. Check worker logs for errors
2. Ensure processor's `process()` method returns (doesn't hang)
3. Check Redis connection health

### Memory Issues

1. Use `withEntityManager()` to avoid memory leaks
2. Implement `afterProcess()` for cleanup
3. Consider reducing concurrency

## Resources

- [PXL Framework Documentation](../../README.md)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/docs/)

## License

See the main framework [LICENSE](../../LICENSE) file.
