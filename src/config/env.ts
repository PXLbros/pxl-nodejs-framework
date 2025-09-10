import { type InferFrameworkConfig } from './schema.js';

// Helper to parse booleans like 'true', '1', 'yes'
function parseBool(v: string | undefined): boolean | undefined {
  if (v == null) return undefined;
  return /^(true|1|yes|on)$/i.test(v);
}

function parseIntEnv(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function splitCsv(v: string | undefined): string[] | undefined {
  if (!v) return undefined;
  return v
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Load a partial framework configuration from environment variables. This is intentionally
 * conservative: only widely useful primitives are supported. Complex structures (e.g. routes)
 * should be defined in code and merged before validation.
 *
 * Naming convention: PXL_<SECTION>_<FIELD>
 */
export function loadFrameworkConfigFromEnv(): Partial<InferFrameworkConfig> {
  const env = process.env;

  const redis = {
    host: env.PXL_REDIS_HOST,
    port: parseIntEnv(env.PXL_REDIS_PORT),
    password: env.PXL_REDIS_PASSWORD,
  };
  if (!redis.host) delete (redis as any).host; // allow omission
  if (!redis.port) delete (redis as any).port;
  if (!redis.password) delete (redis as any).password;

  const databaseEnabled = parseBool(env.PXL_DB_ENABLED);
  const database = {
    enabled: databaseEnabled,
    host: env.PXL_DB_HOST,
    port: parseIntEnv(env.PXL_DB_PORT),
    username: env.PXL_DB_USERNAME,
    password: env.PXL_DB_PASSWORD,
    databaseName: env.PXL_DB_NAME,
    entitiesDirectory: env.PXL_DB_ENTITIES_DIR,
  };
  // prune undefined fields so Zod defaults/optionals apply
  const databaseFinal = {
    ...(database.enabled !== undefined ? { enabled: database.enabled } : {}),
    ...(database.host ? { host: database.host } : {}),
    ...(database.port !== undefined ? { port: database.port } : {}),
    ...(database.username ? { username: database.username } : {}),
    ...(database.password ? { password: database.password } : {}),
    ...(database.databaseName ? { databaseName: database.databaseName } : {}),
    ...(database.entitiesDirectory ? { entitiesDirectory: database.entitiesDirectory } : {}),
  } as any;
  const hasDatabaseConfig = Object.keys(databaseFinal).length > 0;

  const queueProcessorsDirectory = env.PXL_QUEUE_PROCESSORS_DIR;
  const queueQueues = splitCsv(env.PXL_QUEUE_QUEUES)?.map(name => ({ name, jobs: [] }));
  const queue: any = {};
  if (queueProcessorsDirectory) queue.processorsDirectory = queueProcessorsDirectory;
  if (queueQueues) queue.queues = queueQueues;

  const webEnabled = parseBool(env.PXL_WEB_ENABLED);
  const webCorsEnabled = parseBool(env.PXL_WEB_CORS_ENABLED);
  const webCorsUrls = splitCsv(env.PXL_WEB_CORS_URLS);
  const webBodyLimit = parseIntEnv(env.PXL_WEB_BODY_LIMIT);
  const webPort = parseIntEnv(env.PXL_WEB_PORT);
  const web: any = {};
  if (webEnabled !== undefined) web.enabled = webEnabled;
  if (env.PXL_WEB_HOST) web.host = env.PXL_WEB_HOST;
  if (webPort !== undefined) web.port = webPort;
  if (webBodyLimit !== undefined) web.bodyLimit = webBodyLimit;
  if (webCorsEnabled || (webCorsUrls && webCorsUrls.length > 0)) {
    web.cors = { enabled: webCorsEnabled ?? true, urls: webCorsUrls ?? [] };
  }

  const auth: any = {};
  if (env.PXL_AUTH_JWT_SECRET_KEY) auth.jwtSecretKey = env.PXL_AUTH_JWT_SECRET_KEY;

  const cluster: any = {};
  const clusterEnabled = parseBool(env.PXL_CLUSTER_ENABLED);
  if (clusterEnabled !== undefined) cluster.enabled = clusterEnabled;
  const clusterWorkers = parseIntEnv(env.PXL_CLUSTER_WORKERS);
  if (clusterWorkers !== undefined) cluster.workers = clusterWorkers;
  if (Object.keys(cluster).length === 0) {
    // leave cluster undefined later
  }

  const performanceMonitoring: any = {};
  const perfEnabled = parseBool(env.PXL_PERF_ENABLED);
  if (perfEnabled !== undefined) performanceMonitoring.enabled = perfEnabled;
  const perfInterval = parseIntEnv(env.PXL_PERF_REPORT_INTERVAL_MS);
  if (perfInterval !== undefined) performanceMonitoring.reportInterval = perfInterval;
  if (Object.keys(performanceMonitoring).length === 0) {
    // leave undefined later
  }

  const name = env.PXL_NAME;
  const instanceId = env.PXL_INSTANCE_ID;
  const rootDirectory = env.PXL_ROOT_DIR;

  // assemble partial, removing empty objects
  const partial: Partial<InferFrameworkConfig> = {};
  if (name) partial.name = name;
  if (instanceId) partial.instanceId = instanceId;
  if (rootDirectory) partial.rootDirectory = rootDirectory;
  if (redis.host || redis.port || redis.password) partial.redis = redis as any;
  if (hasDatabaseConfig) partial.database = databaseFinal;
  if (Object.keys(queue).length > 0) partial.queue = queue;
  if (Object.keys(web).length > 0) partial.web = web;
  if (Object.keys(auth).length > 0) partial.auth = auth;
  if (Object.keys(cluster).length > 0) partial.cluster = cluster;
  if (Object.keys(performanceMonitoring).length > 0) partial.performanceMonitoring = performanceMonitoring;

  return partial;
}

/** Deep merge helper (shallow for primitives & plain objects) */
// mergeConfig intentionally removed (security lint). If needed later, implement with explicit key lists.
