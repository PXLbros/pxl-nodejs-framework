import logger from '../../logger/logger';
import ApplicationInstance from '../application-instance';
import { CommandApplicationInstanceProps } from './command-application-instance.interface';

export default class CommandApplicationInstance extends ApplicationInstance {
  constructor({ redisInstance, events }: CommandApplicationInstanceProps) {
    super({ redisInstance, events });
  }

  public runCommand(): void {
    logger.debug('Run command');
  }
}
