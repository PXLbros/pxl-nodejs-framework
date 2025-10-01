import { z } from 'zod';
import crypto from 'node:crypto';

// Redis configuration schema
export const RedisConfigSchema = z.object({
  host: z.string().min(1, 'redis.host required'),
  port: z.number().int().positive().default(6379),
  password: z.string().min(1).optional(),
});

// Database configuration schema
export const DatabaseConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    host: z.string().min(1, 'database.host required'),
    port: z.number().int().positive().default(5432),
    username: z.string().min(1, 'database.username required'),
    password: z.string().min(1, 'database.password required'),
    databaseName: z.string().min(1, 'database.databaseName required'),
    entitiesDirectory: z.string().min(1).optional(),
  })
  .partial({ entitiesDirectory: true });

// Queue configuration schema
export const QueueLogConfigSchema = z
  .object({
    jobRegistered: z.boolean().optional(),
    jobAdded: z.boolean().optional(),
    jobCompleted: z.boolean().optional(),
    queueRegistered: z.boolean().optional(),
    queuesRegistered: z.boolean().optional(),
    queueWaiting: z.boolean().optional(),
  })
  .optional();

export const QueueItemSchema = z.object({
  name: z.string(),
  isExternal: z.boolean().optional(),
  jobs: z.array(z.any()).default([]),
});

export const QueueConfigSchema = z.object({
  queues: z.array(QueueItemSchema).default([]),
  processorsDirectory: z.string().min(1, 'queue.processorsDirectory required'),
  log: QueueLogConfigSchema,
});

// Event configuration schema
export const EventDefinitionSchema = z.object({
  name: z.string().min(1),
});

export const EventConfigSchema = z.object({
  enabled: z.boolean().default(false),
  controllersDirectory: z.string().min(1),
  events: z.array(EventDefinitionSchema).default([]),
});

// Log configuration schema
export const LogConfigSchema = z
  .object({
    startUp: z.boolean().optional(),
    shutdown: z.boolean().optional(),
  })
  .optional();

// Performance monitoring schema
export const PerformanceThresholdsSchema = z
  .object({
    httpMs: z.number().int().positive().optional(),
    dbMs: z.number().int().positive().optional(),
    queueMs: z.number().int().positive().optional(),
    cacheMs: z.number().int().positive().optional(),
    wsMs: z.number().int().positive().optional(),
  })
  .partial();

export const PerformanceMonitoringSchema = z
  .object({
    enabled: z.boolean().default(false),
    thresholds: PerformanceThresholdsSchema.optional(),
    maxMetricsHistory: z.number().int().positive().optional(),
    logSlowOperations: z.boolean().optional(),
    logAllOperations: z.boolean().optional(),
    monitorHttpRequests: z.boolean().default(true).optional(),
    monitorDatabaseOperations: z.boolean().default(true).optional(),
    monitorWebSocketOperations: z.boolean().default(true).optional(),
    monitorQueueOperations: z.boolean().default(true).optional(),
    monitorCacheOperations: z.boolean().default(true).optional(),
    reportInterval: z.number().int().positive().default(60_000).optional(),
    reportFormat: z.enum(['simple', 'detailed']).default('simple').optional(),
  })
  .partial();

// Auth configuration schema
export const AuthConfigSchema = z
  .object({
    jwtSecretKey: z.string().min(1, 'auth.jwtSecretKey required'),
  })
  .optional();

// Security configuration schema
export const SecurityConfigSchema = z
  .object({
    helmet: z
      .object({
        enabled: z.boolean().optional(),
        contentSecurityPolicy: z.boolean().optional(),
        crossOriginEmbedderPolicy: z.boolean().optional(),
        crossOriginOpenerPolicy: z.boolean().optional(),
        crossOriginResourcePolicy: z.boolean().optional(),
        dnsPrefetchControl: z.boolean().optional(),
        frameguard: z.boolean().optional(),
        hidePoweredBy: z.boolean().optional(),
        hsts: z.boolean().optional(),
        ieNoOpen: z.boolean().optional(),
        noSniff: z.boolean().optional(),
        originAgentCluster: z.boolean().optional(),
        permittedCrossDomainPolicies: z.boolean().optional(),
        referrerPolicy: z.boolean().optional(),
        xssFilter: z.boolean().optional(),
      })
      .optional(),
    rateLimit: z
      .object({
        enabled: z.boolean().optional(),
        max: z.number().int().positive().optional(),
        timeWindow: z.string().optional(),
        ban: z.number().int().optional(),
        cache: z.number().int().optional(),
      })
      .optional(),
  })
  .optional();

// Web server configuration schema
export const WebServerRouteSchema = z
  .object({
    type: z.string().optional(),
    method: z.union([z.string(), z.array(z.string())]).optional(),
    path: z.string(),
    url: z.string().optional(), // Keep for backwards compatibility
    controller: z.any().optional(), // Controller class reference
    controllerName: z.string().optional(),
    action: z.string().optional(),
    entityName: z.string().optional(),
    validation: z.any().optional(),
  })
  .passthrough(); // Allow additional properties to pass through

export const WebServerConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    host: z.string().default('0.0.0.0'),
    port: z.number().int().positive().default(3001),
    bodyLimit: z
      .number()
      .int()
      .positive()
      .default(25 * 1024 * 1024), // 25MB default (was 100MB)
    connectionTimeout: z
      .number()
      .int()
      .positive()
      .default(10 * 1000), // 10s default (was 30s)
    routes: z.array(WebServerRouteSchema).default([]),
    controllersDirectory: z.string().optional(), // Controllers directory path
    cors: z
      .object({
        enabled: z.boolean().default(false),
        urls: z.array(z.string()).default([]),
      })
      .optional(),
    security: SecurityConfigSchema.optional(),
    debug: z
      .object({
        logAllRegisteredRoutes: z.boolean().optional(),
      })
      .default({})
      .optional(),
  })
  .partial({ cors: true, debug: true, controllersDirectory: true, security: true });

// WebSocket configuration schema
export const WebSocketRouteSchema = z.object({
  type: z.string().min(1, 'webSocket.routes.type required'),
  controllerName: z.string().min(1, 'webSocket.routes.controllerName required'),
  action: z.string().min(1, 'webSocket.routes.action required'),
  controller: z.any().optional(),
});

export const WebSocketConfigSchema = z
  .object({
    type: z.string().default('native'),
    enabled: z.boolean().default(false),
    routes: z.array(WebSocketRouteSchema).default([]),
  })
  .partial();

// Cluster configuration schema
export const ClusterConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    workers: z.number().int().positive().optional(),
  })
  .partial();

// Top-level framework configuration schema
export const FrameworkConfigSchema = z.object({
  name: z.string().min(1, 'name required'),
  instanceId: z.string().default(() => crypto.randomUUID()),
  rootDirectory: z.string().min(1, 'rootDirectory required'),
  cluster: ClusterConfigSchema.optional(),
  redis: RedisConfigSchema,
  cache: z.object({}).optional(),
  database: DatabaseConfigSchema.optional(),
  queue: QueueConfigSchema,
  event: EventConfigSchema.optional(),
  log: LogConfigSchema,
  performanceMonitoring: PerformanceMonitoringSchema.optional(),
  email: z.object({}).optional(),
  auth: AuthConfigSchema,
  web: WebServerConfigSchema.optional(),
  webServer: WebServerConfigSchema.optional(), // Support both 'web' and 'webServer' for compatibility
  webSocket: WebSocketConfigSchema.optional(),
});

export type InferFrameworkConfig = z.infer<typeof FrameworkConfigSchema>;

export interface ValidateConfigOptions {
  collectAllErrors?: boolean; // Reserved for future use; Zod currently throws aggregate anyway
}

export interface ValidationIssueDetail {
  path: string;
  message: string;
}

export class ConfigValidationError extends Error {
  public issues: ValidationIssueDetail[];
  constructor(message: string, issues: ValidationIssueDetail[]) {
    super(message);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

export function validateFrameworkConfig(raw: unknown, _options: ValidateConfigOptions = {}): InferFrameworkConfig {
  const result = FrameworkConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues: ValidationIssueDetail[] = result.error.issues.map((i: any) => ({
      path: (i.path.join('.') ?? '(root)') as string,
      message: i.message as string,
    }));
    throw new ConfigValidationError('Invalid framework configuration', issues);
  }
  return result.data;
}

export function formatConfigIssues(issues: ValidationIssueDetail[]): string {
  return issues.map(i => ` - ${i.path}: ${i.message}`).join('\n');
}

export default FrameworkConfigSchema;
