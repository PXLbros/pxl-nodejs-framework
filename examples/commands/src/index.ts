/**
 * PXL Framework - Command Application Example
 *
 * This example demonstrates how to build a modern CLI application using
 * the PXL Framework's CommandApplication class.
 *
 * Features demonstrated:
 * - CommandApplication setup and configuration
 * - Multiple command implementations
 * - Command-line argument parsing with yargs
 * - Database, Redis, and Queue integration
 * - Graceful shutdown handling
 * - Error handling and logging
 * - Modern 2025 TypeScript patterns
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CommandApplication } from '../../../src/application/index.js';
import { CommandManager } from '../../../src/command/index.js';
import type { CommandApplicationConfig } from '../../../src/application/command-application.interface.js';
import pc from 'picocolors';

// Get current directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main application entry point
 */
async function main() {
  console.log(pc.bold(pc.cyan('\n╔════════════════════════════════════════╗')));
  console.log(pc.bold(pc.cyan('║  PXL Framework - CLI Commands Example ║')));
  console.log(pc.bold(pc.cyan('╚════════════════════════════════════════╝\n')));

  // Initialize CommandManager with yargs
  const commandManager = new CommandManager();

  // Configure command arguments and options
  commandManager
    .addOption({
      option: 'name',
      description: 'Name to greet (for hello command)',
      type: 'string',
    })
    .addOption({
      option: 'count',
      description: 'Number of times or items (for hello and other commands)',
      type: 'number',
    })
    .addOption({
      option: 'uppercase',
      description: 'Convert output to uppercase (for hello command)',
      type: 'boolean',
    })
    .addOption({
      option: 'clear',
      description: 'Clear existing data before operation (for seed command)',
      type: 'boolean',
    })
    .addOption({
      option: 'action',
      description: 'Action to perform (for queue command: status, add, clear)',
      type: 'string',
    })
    .addOption({
      option: 'queue',
      description: 'Queue name to operate on (for queue command)',
      type: 'string',
    });

  // Create application configuration
  const config: CommandApplicationConfig = {
    // Basic application info
    name: 'pxl-commands-example',
    instanceId: `commands-${process.pid}`,
    rootDirectory: join(__dirname, '..'),

    // Command configuration
    commandsDirectory: join(__dirname, 'commands'),
    commandManager,

    // Debug options
    debug: {
      measureExecutionTime: process.env.MEASURE_EXECUTION_TIME === 'true',
    },

    // Redis configuration (required by framework)
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    },

    // Queue configuration (required by framework)
    queue: {
      processorsDirectory: join(__dirname, 'processors'), // Not used in this example
      queues: [], // No queues configured for this example
    },

    // Auth configuration (required by framework validation)
    auth: {
      jwtSecretKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    },

    // Database configuration (optional - uncomment if you want to use database)
    /*
    database: {
      enabled: true,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      databaseName: process.env.DB_NAME || 'pxl_commands_dev',
      entitiesDirectory: join(__dirname, 'database', 'entities'),
    },
    */

    // Lifecycle configuration
    log: {
      startUp: false, // Don't log startup for commands
    },

    // Event configuration (optional)
    event: {
      enabled: false,
      controllersDirectory: join(__dirname, 'events'), // Required by validation even when disabled
    },
  };

  try {
    // Create and start the command application
    const app = new CommandApplication(config);

    // Setup graceful shutdown handlers
    let shutdownInProgress = false;

    const shutdown = async (signal: string) => {
      if (shutdownInProgress) {
        console.log(pc.yellow(`\n${signal} received again, forcing exit...`));
        process.exit(130);
        return;
      }

      shutdownInProgress = true;
      console.log(pc.yellow(`\n${signal} received, shutting down gracefully...`));

      try {
        await app.stop();
        console.log(pc.green('Shutdown complete'));
        process.exit(0);
      } catch (error) {
        console.error(pc.red('Error during shutdown:'), error);
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));

    // Start the application (this will parse arguments and run the command)
    await app.start();
  } catch (error) {
    console.error(pc.red('\n✗ Application failed:'), error);
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error(pc.red('Unhandled error:'), error);
  process.exit(1);
});
