import { Argv } from 'yargs';
declare class CommandManager {
    argv: Argv;
    constructor();
    addCommand({ command, description, builder, handler }: {
        command: string;
        description: string;
        builder: (yargs: Argv) => Argv;
        handler: (argv: any) => void;
    }): this;
    addOption({ option, description, type }: {
        option: string;
        description: string;
        type: 'string' | 'boolean' | 'number';
    }): this;
    parse(): void;
}
export default CommandManager;
//# sourceMappingURL=command-manager.d.ts.map