import RedisInstance from '../redis/redis-instance';

export interface WebServerConfig {
  port: number;
}

export interface WebServerProps {
  config: WebServerConfig;

  redisInstance: RedisInstance;
}
