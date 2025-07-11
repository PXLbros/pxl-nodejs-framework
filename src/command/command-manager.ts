import yargs, { type Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';

class CommandManager {
  public argv: Argv;

  constructor() {
    this.argv = yargs(hideBin(process.argv)).help().alias('help', 'h');

    this.argv.parse();
  }

  public addCommand({
    command,
    description,
    builder,
    handler,
  }: {
    command: string;
    description: string;
    builder: (yargs: Argv) => Argv;
    handler: (argv: any) => void;
  }): this {
    this.argv.command(command, description, builder, handler);

    return this;
  }

  public addOption({
    option,
    description,
    type,
  }: {
    option: string;
    description: string;
    type: 'string' | 'boolean' | 'number';
  }): this {
    this.argv.option(option, {
      description,
      type,
    });

    return this;
  }

  public parse(): void {
    this.argv.parse();
  }
}

export default CommandManager;
