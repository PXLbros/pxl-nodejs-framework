/**
 * Hello Command
 *
 * A simple command demonstrating basic CLI functionality with arguments and options.
 * This command showcases:
 * - Basic command structure
 * - Command-line arguments parsing
 * - Options/flags handling
 * - Colored console output
 * - Logging integration
 */

import { Command } from '../../../../src/command/index.js';
import type { CommandConstructorParams } from '../../../../src/command/command.interface.js';
import pc from 'picocolors';

export default class HelloCommand extends Command {
  public name = 'hello';
  public description = 'A simple greeting command that demonstrates basic CLI functionality';

  constructor(params: CommandConstructorParams) {
    super(params);
  }

  /**
   * Run the hello command
   *
   * @param argv - Parsed command-line arguments from yargs
   */
  public async run(argv?: any): Promise<void> {
    // Extract arguments and options
    const name = argv?.name || 'World';
    const count = argv?.count || 1;
    const uppercase = argv?.uppercase || false;

    this.log('Command started', { name, count, uppercase });

    console.log(pc.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(pc.cyan('  Hello Command'));
    console.log(pc.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    // Generate greeting message
    let greeting = `Hello, ${name}!`;

    if (uppercase) {
      greeting = greeting.toUpperCase();
    }

    // Display greeting multiple times
    for (let i = 1; i <= count; i++) {
      if (count > 1) {
        console.log(pc.green(`  ${i}. ${greeting}`));
      } else {
        console.log(pc.green(`  ${greeting}`));
      }
    }

    console.log('');

    // Show some framework information
    console.log(pc.dim('  Framework Information:'));
    console.log(pc.dim(`  • Application: ${this.applicationConfig.name}`));
    console.log(pc.dim(`  • Redis: ${this.applicationConfig.redis.host}:${this.applicationConfig.redis.port}`));
    console.log(pc.dim(`  • Command: ${this.name}`));

    // Demonstrate Redis connectivity (if available)
    try {
      const isConnected = await this.redisInstance.isConnected();
      if (isConnected) {
        console.log(pc.green(`  • Redis Status: Connected ✓`));

        // Store a greeting in Redis as a demo
        const key = `greeting:${Date.now()}`;
        await this.redisInstance.setCache({ key, value: greeting, expiration: 60 });
        console.log(pc.dim(`  • Stored in Redis: ${key}`));
      } else {
        console.log(pc.yellow(`  • Redis Status: Disconnected`));
      }
    } catch (error) {
      console.log(pc.yellow(`  • Redis Status: Error - ${error instanceof Error ? error.message : String(error)}`));
    }

    console.log(pc.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    this.log('Command completed successfully');
  }
}
