import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadFrameworkConfigFromEnv } from '../../../src/config/env.js';

const ENV_KEYS = [
  'PXL_REDIS_HOST',
  'PXL_REDIS_PORT',
  'PXL_REDIS_PASSWORD',
  'PXL_DB_ENABLED',
  'PXL_DB_HOST',
  'PXL_DB_PORT',
  'PXL_DB_USERNAME',
  'PXL_DB_PASSWORD',
  'PXL_DB_NAME',
  'PXL_DB_ENTITIES_DIR',
  'PXL_QUEUE_PROCESSORS_DIR',
  'PXL_QUEUE_QUEUES',
  'PXL_WEB_ENABLED',
  'PXL_WEB_HOST',
  'PXL_WEB_PORT',
  'PXL_WEB_BODY_LIMIT',
  'PXL_WEB_CORS_ENABLED',
  'PXL_WEB_CORS_URLS',
  'PXL_AUTH_JWT_SECRET_KEY',
  'PXL_CLUSTER_ENABLED',
  'PXL_CLUSTER_WORKERS',
  'PXL_PERF_ENABLED',
  'PXL_PERF_REPORT_INTERVAL_MS',
  'PXL_NAME',
  'PXL_INSTANCE_ID',
  'PXL_ROOT_DIR',
];

const originalValues = new Map<string, string | undefined>();

beforeEach(() => {
  originalValues.clear();
  for (const key of ENV_KEYS) {
    originalValues.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const [key, value] of originalValues.entries()) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('loadFrameworkConfigFromEnv', () => {
  it('returns an empty object when no relevant variables are set', () => {
    expect(loadFrameworkConfigFromEnv()).toEqual({});
  });

  it('parses environment variables into partial framework configuration', () => {
    Object.assign(process.env, {
      PXL_NAME: 'pxl-app',
      PXL_INSTANCE_ID: 'instance-1',
      PXL_ROOT_DIR: '/srv/app',
      PXL_REDIS_HOST: 'redis.local',
      PXL_REDIS_PORT: '6379',
      PXL_DB_ENABLED: 'true',
      PXL_DB_HOST: 'db.local',
      PXL_DB_PORT: '5432',
      PXL_DB_USERNAME: 'pxl',
      PXL_DB_PASSWORD: 'secret',
      PXL_DB_NAME: 'pxl_db',
      PXL_DB_ENTITIES_DIR: '/srv/entities',
      PXL_QUEUE_PROCESSORS_DIR: '/srv/queues',
      PXL_QUEUE_QUEUES: 'emails,notifications',
      PXL_WEB_ENABLED: 'yes',
      PXL_WEB_HOST: '0.0.0.0',
      PXL_WEB_PORT: '8080',
      PXL_WEB_BODY_LIMIT: '1048576',
      PXL_WEB_CORS_ENABLED: '1',
      PXL_WEB_CORS_URLS: 'https://app.test, https://admin.test',
      PXL_AUTH_JWT_SECRET_KEY: 'super-secret',
      PXL_CLUSTER_ENABLED: 'false',
      PXL_CLUSTER_WORKERS: '4',
      PXL_PERF_ENABLED: 'on',
      PXL_PERF_REPORT_INTERVAL_MS: '5000',
    });

    const config = loadFrameworkConfigFromEnv();

    expect(config).toMatchObject({
      name: 'pxl-app',
      instanceId: 'instance-1',
      rootDirectory: '/srv/app',
      redis: {
        host: 'redis.local',
        port: 6379,
      },
      database: {
        enabled: true,
        host: 'db.local',
        port: 5432,
        username: 'pxl',
        password: 'secret',
        databaseName: 'pxl_db',
        entitiesDirectory: '/srv/entities',
      },
      queue: {
        processorsDirectory: '/srv/queues',
        queues: [
          { name: 'emails', jobs: [] },
          { name: 'notifications', jobs: [] },
        ],
      },
      web: {
        enabled: true,
        host: '0.0.0.0',
        port: 8080,
        bodyLimit: 1048576,
        cors: {
          enabled: true,
          urls: ['https://app.test', 'https://admin.test'],
        },
      },
      auth: {
        jwtSecretKey: 'super-secret',
      },
      cluster: {
        enabled: false,
        workers: 4,
      },
      performanceMonitoring: {
        enabled: true,
        reportInterval: 5000,
      },
    });
  });
});
