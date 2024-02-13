import { Request, Response, NextFunction } from 'express';
import cluster from 'cluster';
import { logger } from '~/lib';
import { timeUtil } from '~/utils';

export default (request: Request, response: Response, next: NextFunction) => {
  const pathsToIgnore = ['/health'];

  if (pathsToIgnore.includes(request.path)) {
    next();
  } else {
    const startTime = process.hrtime();
    const ip = request.headers['x-forwarded-for'] || request.socket.remoteAddress;

    const logDetails = () => {
      const executionTime = timeUtil.calculateElapsedTime({ startTime });
      const formattedExecutionTime = timeUtil.formatTime({ time: executionTime, numDecimals: 2 });

      const logParams: any = {
        Method: request.method,
        Path: request.path,
        Status: response.statusCode,
        IP: ip,
        Time: formattedExecutionTime,
      };

      if (cluster.isWorker && cluster.worker) {
        logParams.Worker = cluster.worker.id;
      }

      logger.debug('API Request', logParams);
    };

    response.on('finish', logDetails);

    next();
  }
};
