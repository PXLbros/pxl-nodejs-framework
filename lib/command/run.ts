import { logger } from '~/lib';
import { CommandApplicationManager } from '~/lib/app';
import { timeUtil } from '~/utils';

// Initialize command application manager
const commandApplicationManager = new CommandApplicationManager();

// Start command application manager
commandApplicationManager.start({
  events: {
    onStarted: ({ commandName }) => {
      logger.info('Command started', { Name: commandName });
    },

    onCompleted: ({ commandName, executionTime }) => {
      logger.info('Command completed', {
        Name: commandName,
        'Execution Time': timeUtil.formatTime({ time: executionTime, format: 's', numDecimals: 3 }),
      });
    },
  },
});
