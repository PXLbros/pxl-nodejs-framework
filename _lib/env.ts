import dotenv from 'dotenv';
import { bool, cleanEnv, num, str } from 'envalid';

// Load environment variables
dotenv.config();

// Validate environment variables
const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['local', 'development', 'production'],
    desc: 'Environment',
  }),

  DB_HOST: str({ desc: 'Database host' }),
  DB_PORT: num({ desc: 'Database port' }),
  DB_USER: str({ desc: 'Database user' }),
  DB_PASSWORD: str({ desc: 'Database password' }),
  DB_NAME: str({ desc: 'Database name' }),

  REDIS_HOST: str({ desc: 'Redis host' }),
  REDIS_PORT: num({ desc: 'Redis port' }),
  REDIS_PASSWORD: str({ desc: 'Redis password', default: '' }),

  WEBSERVER_PORT: num({ desc: 'Web server port', default: 3001 }),
  WEBSOCKET_PORT: num({ desc: 'WebSocket port', default: 3002 }),

  CLUSTER_ENABLED: bool({ desc: 'Whether to use cluster', default: false }),
  CLUSTER_WORKER_MODE: str({ choices: ['auto', 'manual'], desc: 'Cluster worker mode', default: 'auto' }),
  NUM_CLUSTER_WORKERS: num({ desc: 'Number of cluster workers', default: 2 }),

  SENTRY_DSN: str({ desc: 'Sentry DSN', default: '' }),
});

export default env;
