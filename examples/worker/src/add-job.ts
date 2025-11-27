/**
 * Utility script to add jobs to the queue for testing
 *
 * Usage:
 *   npm run add-job
 *   npm run add-job -- --count 10
 *   npm run add-job -- --message "Custom message"
 */

import 'dotenv/config';
import { Queue } from 'bullmq';
import pc from 'picocolors';

async function main() {
  const args = process.argv.slice(2);
  const count = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] || '1', 10);
  const message = args.find(a => a.startsWith('--message='))?.split('=')[1] || 'Hello from test job';

  console.log(pc.cyan('\nAdding jobs to queue...\n'));

  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  const queue = new Queue('default', { connection });

  try {
    for (let i = 0; i < count; i++) {
      const jobData = {
        payload: {
          message: `${message} #${i + 1}`,
          delay: Math.floor(Math.random() * 2000) + 500, // Random delay 500-2500ms
        },
      };

      const job = await queue.add('example-processor', jobData);
      console.log(pc.green(`  ✓ Added job ${job.id}: "${jobData.payload.message}"`));
    }

    console.log(pc.cyan(`\n✓ Added ${count} job(s) to 'default' queue\n`));
  } catch (error) {
    console.error(pc.red('Error adding jobs:'), error);
    process.exit(1);
  } finally {
    await queue.close();
  }
}

main().catch(error => {
  console.error(pc.red('Unhandled error:'), error);
  process.exit(1);
});
