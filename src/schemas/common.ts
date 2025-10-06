import { z } from 'zod';

/**
 * Common Zod schemas for reuse across the framework
 */

// ============================================================================
// ID Schemas
// ============================================================================

/**
 * Numeric ID schema (positive integer)
 */
export const NumericIdSchema = z.coerce.number().int().positive();

/**
 * UUID v4 schema
 */
export const UuidSchema = z.string().uuid();

/**
 * Optional numeric ID (for updates where ID may not be required)
 */
export const OptionalNumericIdSchema = NumericIdSchema.optional();

// ============================================================================
// Pagination Schemas
// ============================================================================

/**
 * Pagination query parameters schema
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Inferred type for pagination query
 */
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Paginated response wrapper schema
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) => {
  return z.object({
    data: z.array(itemSchema),
    total_items: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
  });
};

/**
 * Helper type for paginated response
 */
export type PaginatedResponse<T> = {
  data: T[];
  total_items: number;
  page: number;
  total_pages: number;
  limit: number;
};

// ============================================================================
// Sorting & Filtering Schemas
// ============================================================================

/**
 * Sort order schema
 */
export const SortOrderSchema = z.enum(['ASC', 'DESC', 'asc', 'desc']).default('ASC');

/**
 * Generic sort query schema
 */
export const SortQuerySchema = z.object({
  sort: z.string().optional(),
  'sort-order': SortOrderSchema.optional(),
});

/**
 * Search query schema
 */
export const SearchQuerySchema = z.object({
  search: z.string().min(1).optional(),
});

/**
 * Combined list query schema (pagination + sorting + search)
 */
export const ListQuerySchema = PaginationQuerySchema.merge(SortQuerySchema).merge(SearchQuerySchema);

/**
 * Inferred type for list query
 */
export type ListQuery = z.infer<typeof ListQuerySchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Success response wrapper schema
 */
export const createSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => {
  return z.object({
    data: dataSchema,
  });
};

/**
 * Error response schema
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  statusCode: z.number().int().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Inferred type for error response
 */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Generic API response schema (success or error)
 */
export const createApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => {
  return z.union([createSuccessResponseSchema(dataSchema), ErrorResponseSchema]);
};

// ============================================================================
// Common Field Schemas
// ============================================================================

/**
 * Email schema
 */
export const EmailSchema = z.string().email();

/**
 * URL schema
 */
export const UrlSchema = z.string().url();

/**
 * Phone number schema (basic validation)
 */
export const PhoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/);

/**
 * Date string schema (ISO 8601)
 */
export const DateStringSchema = z.string().datetime();

/**
 * Non-empty string schema
 */
export const NonEmptyStringSchema = z.string().min(1);

/**
 * Trimmed non-empty string schema
 */
export const TrimmedStringSchema = z.string().trim().min(1);

/**
 * Boolean schema with string coercion
 */
export const BooleanSchema = z.union([z.boolean(), z.string()]).transform(val => {
  return typeof val === 'string' ? val === 'true' : val;
});

// ============================================================================
// Timestamp Schemas
// ============================================================================

/**
 * Created/Updated timestamp schema
 */
export const TimestampSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Optional timestamp schema
 */
export const OptionalTimestampSchema = z.object({
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// ============================================================================
// Utility Schemas
// ============================================================================

/**
 * Comma-separated string to array transformer
 */
export const CommaSeparatedStringSchema = z.string().transform(val => {
  return val.split(',').map(item => item.trim());
});

/**
 * JSON string schema (parses JSON string to object)
 */
export const JsonStringSchema = z.string().transform((str, _ctx) => {
  try {
    return JSON.parse(str);
  } catch {
    _ctx.addIssue({ code: 'custom', message: 'Invalid JSON string' });
    return z.NEVER;
  }
});

// ============================================================================
// Health Check Schemas
// ============================================================================

/**
 * Health check response schema
 */
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.string().datetime(),
  services: z
    .record(
      z.string(),
      z.object({
        status: z.enum(['up', 'down', 'degraded']),
        message: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Inferred type for health check response
 */
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
