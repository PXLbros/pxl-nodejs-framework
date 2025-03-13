import { existsSync } from 'fs';
import { Logger } from '../logger/index.js';
import BaseApplication from './base-application.js';
import { Helper, Loader, Time } from '../util/index.js';
export default class CommandApplication extends BaseApplication {
    /** Command application config */
    config;
    constructor(config) {
        super(config);
        const defaultConfig = {
            cluster: {
                enabled: false,
            },
            log: {
                startUp: false,
            },
            debug: {
                measureExecutionTime: false,
            },
        };
        const mergedConfig = Helper.defaultsDeep(config, defaultConfig);
        if (mergedConfig.cluster) {
            mergedConfig.cluster.enabled = false;
        }
        this.config = mergedConfig;
    }
    async startHandler({ redisInstance, databaseInstance, queueManager }) {
        const startTime = performance.now();
        // get argv (yargs) input args
        const argv = this.config.commandManager.argv;
        const parsedArgv = argv.parseSync();
        if (parsedArgv._.length === 0) {
            Logger.warn('No command provided');
            this.stopCommand();
            return;
        }
        const inputCommandName = parsedArgv._[0];
        const commandsDirectoryExists = await existsSync(this.config.commandsDirectory);
        if (!commandsDirectoryExists) {
            Logger.warn('Commands directory not found', { Directory: this.config.commandsDirectory });
            return;
        }
        // Load commands
        const commands = await Loader.loadModulesInDirectory({
            directory: this.config.commandsDirectory,
            extensions: ['.ts', '.js'],
        });
        // Find command by name
        const CommandClass = commands[inputCommandName];
        if (!CommandClass) {
            Logger.warn('Command not found', { Command: inputCommandName });
            return;
        }
        // Initialize command
        const command = new CommandClass({
            applicationConfig: this.config,
            redisInstance: redisInstance,
            queueManager: queueManager,
            databaseInstance: databaseInstance,
        });
        Logger.info('Command started', { Command: inputCommandName });
        // Run command
        await command.run(parsedArgv);
        const commandCompletedLogParams = {
            Command: inputCommandName,
        };
        if (this.config.debug?.measureExecutionTime) {
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            commandCompletedLogParams['Execution Time'] = Time.formatTime({ time: executionTime, numDecimals: 2, showUnit: true });
        }
        Logger.info('Command completed', commandCompletedLogParams);
        // Call shutdown signtal to stop the command
        this.stopCommand();
    }
    stopCommand() {
        process.kill(process.pid, 'SIGINT');
    }
    stopCallback() {
        Logger.info('Command stopped');
    }
}
//# sourceMappingURL=command-application.js.map