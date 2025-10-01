/**
 * Database Seed Command
 *
 * Demonstrates database integration in commands.
 * This command showcases:
 * - Database connection handling
 * - Entity management with MikroORM
 * - Error handling in database operations
 * - Progress indication for long operations
 * - Transaction support
 */

import { Command } from '../../../../src/command/index.js';
import type { CommandConstructorParams } from '../../../../src/command/command.interface.js';
import pc from 'picocolors';

export default class DatabaseSeedCommand extends Command {
  public name = 'database-seed';
  public description = 'Seed the database with sample data (requires database configuration)';

  constructor(params: CommandConstructorParams) {
    super(params);
  }

  /**
   * Run the database seed command
   *
   * @param argv - Parsed command-line arguments from yargs
   */
  public async run(argv?: any): Promise<void> {
    const clear = argv?.clear || false;
    const count = argv?.count || 10;

    this.log('Command started', { clear, count });

    console.log(pc.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(pc.cyan('  Database Seed Command'));
    console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    // Check if database is configured
    if (!this.databaseInstance) {
      console.log(pc.yellow('  ⚠ Database is not configured'));
      console.log(pc.dim('  This command requires database configuration.'));
      console.log(pc.dim('  Please configure database in your application config.\n'));
      return;
    }

    try {
      // Check database connection
      const isConnected = await this.databaseInstance.isConnected();

      if (!isConnected) {
        console.log(pc.red('  ✗ Database is not connected'));
        console.log(pc.dim('  Please check your database configuration.\n'));
        return;
      }

      console.log(pc.green('  ✓ Database connected'));
      console.log(pc.dim(`  Host: ${this.applicationConfig.database?.host}:${this.applicationConfig.database?.port}`));
      console.log(pc.dim(`  Database: ${this.applicationConfig.database?.databaseName}\n`));

      // Note: In a real application, you would:
      // 1. Get the EntityManager from databaseInstance
      // 2. Create or find your entity repositories
      // 3. Insert/update seed data
      // 4. Use transactions for data integrity

      // Example structure (commented out as we don't have entities in this example):
      /*
      const em = this.databaseInstance.getEntityManager();

      if (clear) {
        console.log(pc.yellow('  Clearing existing data...'));
        await em.nativeDelete(YourEntity, {});
        console.log(pc.green('  ✓ Data cleared\n'));
      }

      console.log(pc.blue(`  Seeding ${count} records...`));

      for (let i = 0; i < count; i++) {
        const entity = em.create(YourEntity, {
          // Your entity data here
        });
        em.persist(entity);

        // Show progress
        if ((i + 1) % 10 === 0 || i === count - 1) {
          process.stdout.write(`\r  Progress: ${i + 1}/${count}`);
        }
      }

      console.log(''); // New line after progress

      await em.flush();
      console.log(pc.green(`  ✓ Successfully seeded ${count} records\n`));
      */

      // For this example, we'll just demonstrate the pattern
      console.log(pc.blue('  Example Seed Pattern:'));
      console.log(pc.dim('  1. Get EntityManager from databaseInstance'));
      console.log(pc.dim('  2. Optionally clear existing data'));
      console.log(pc.dim('  3. Create and persist entities'));
      console.log(pc.dim('  4. Flush changes to database'));
      console.log(pc.dim('  5. Show progress and results\n'));

      console.log(pc.green('  ✓ Seed operation would complete here'));
      console.log(pc.dim(`  Note: Add your entities to actually seed data\n`));

      // Demonstrate storing metadata in Redis
      if (this.redisInstance) {
        const seedMetadata = {
          timestamp: new Date().toISOString(),
          recordCount: count,
          cleared: clear,
        };

        await this.redisInstance.set('last-seed-metadata', JSON.stringify(seedMetadata), 'EX', 3600);
        console.log(pc.dim('  Seed metadata stored in Redis'));
      }
    } catch (error) {
      console.log(pc.red('\n  ✗ Error during seed operation:'));
      console.log(pc.red(`  ${error instanceof Error ? error.message : String(error)}\n`));

      this.logger.error({
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'Database seed failed',
      });

      throw error;
    }

    console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    this.log('Command completed');
  }
}
