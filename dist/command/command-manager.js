import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
class CommandManager {
    argv;
    constructor() {
        this.argv = yargs(hideBin(process.argv))
            .help()
            .alias('help', 'h');
        this.argv.parse();
    }
    addCommand({ command, description, builder, handler }) {
        this.argv.command(command, description, builder, handler);
        return this;
    }
    addOption({ option, description, type }) {
        this.argv.option(option, {
            description,
            type,
        });
        return this;
    }
    parse() {
        this.argv.parse();
    }
}
export default CommandManager;
//# sourceMappingURL=command-manager.js.map