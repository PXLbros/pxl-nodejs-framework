import winston from 'winston';
import { Logger } from '../../src/logger/logger';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

describe('Logging Levels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['debug', 'Test debug message'],
    ['info', 'Test info message'],
    ['warn', 'Test warn message'],
    ['error', 'Test error message'],
  ])('should log %s messages correctly', (level, message) => {
    const spy = jest.spyOn(winston.Logger.prototype, 'log');
    const logger = Logger.getInstance();

    logger[level as LogLevel](message);

    expect(spy).toHaveBeenCalledWith(level, message, undefined);
  });
});

describe('Error Handling', () => {
  it('should log error stack if available', () => {
    const spy = jest.spyOn(winston.Logger.prototype, 'log');
    const logger = Logger.getInstance();
    const error = new Error('Test error');

    logger.error(error);

    expect(spy).toHaveBeenCalledWith('error', expect.stringContaining(error.stack || ''), undefined);
  });
});

describe('Metadata Logging', () => {
  it('should include metadata in the log message if provided', () => {
    const spy = jest.spyOn(winston.Logger.prototype, 'log');
    const logger = Logger.getInstance();
    const meta = { userId: 123, action: 'test' };

    logger.info('User action', meta);

    expect(spy).toHaveBeenCalledWith('info', 'User action', meta);
  });
});
