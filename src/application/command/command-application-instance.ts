import ApplicationInstance from '../application-instance';
import { CommandApplicationInstanceProps } from './command-application-instance.interface';

export default class CommandApplicationInstance extends ApplicationInstance {
  constructor({ redisInstance }: CommandApplicationInstanceProps) {
    super({ redisInstance });
  }
}
