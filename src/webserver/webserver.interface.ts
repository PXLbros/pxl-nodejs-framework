import RedisInstance from '../redis/redis-instance';

export interface WebServerConfig {
  port: number;

  corsOrigins?: string[];
}

export interface WebServerProps {
  config: WebServerConfig;

  redisInstance: RedisInstance;
}
