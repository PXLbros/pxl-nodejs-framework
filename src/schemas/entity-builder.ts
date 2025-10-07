import { z } from 'zod';

/**
 * Options for building standardized entity schemas.
 * - shape: base create shape (required fields for creation)
 * - updatableFields: subset of keys allowed in updates (defaults to all keys of shape)
 * - readAugment: additional fields present on the persisted/read model (e.g. id, timestamps)
 * - strict: apply .strict() to objects (defaults true)
 */
export interface BuildEntitySchemasOptions<
  Shape extends z.ZodRawShape,
  Updatable extends keyof Shape = keyof Shape,
  ReadAugment extends z.ZodRawShape = {},
> {
  shape: Shape;
  updatableFields?: readonly Updatable[];
  readAugment?: ReadAugment; // fields that exist after persistence (e.g. id, createdAt)
  strict?: boolean;
  requireAtLeastOneOnUpdate?: boolean; // default true
}

export interface BuiltEntitySchemas<
  Shape extends z.ZodRawShape,
  Updatable extends keyof Shape,
  ReadAugment extends z.ZodRawShape,
> {
  create: z.ZodObject<Shape>;
  /** Update schema is a partial over selected updatable keys. */
  update: z.ZodTypeAny;
  read: z.ZodObject<Shape & ReadAugment>;
  keys: (keyof Shape)[];
  updatableKeys: Updatable[];
}

export function buildEntitySchemas<
  Shape extends z.ZodRawShape,
  Updatable extends keyof Shape = keyof Shape,
  ReadAugment extends z.ZodRawShape = {},
>(
  options: BuildEntitySchemasOptions<Shape, Updatable, ReadAugment>,
): BuiltEntitySchemas<Shape, Updatable, ReadAugment> {
  const { shape, updatableFields, readAugment, strict = true, requireAtLeastOneOnUpdate = true } = options;

  // Freeze to avoid accidental mutation
  Object.freeze(shape);

  const create = strict ? z.object(shape).strict() : z.object(shape);

  const updatableKeys = updatableFields ? [...updatableFields] : (Object.keys(shape) as Updatable[]);
  // Build pick mask for updatable keys
  const pickMask = updatableKeys.reduce<Record<string, true>>((acc, key) => {
    acc[String(key)] = true;
    return acc;
  }, {});

  const updateBase = updatableFields ? (create as z.ZodObject<any>).pick(pickMask) : (create as z.ZodObject<any>);
  let updateObject: z.ZodTypeAny = updateBase.partial();

  if (requireAtLeastOneOnUpdate) {
    updateObject = updateObject.refine(
      (value: unknown) =>
        !!value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length > 0,
      'At least one field must be provided for update',
    );
  }

  const readShape = { ...shape, ...(readAugment ?? {}) } as Shape & ReadAugment;
  const read = strict ? z.object(readShape).strict() : z.object(readShape);

  return {
    create,
    update: updateObject,
    read: read as z.ZodObject<Shape & ReadAugment>,
    keys: Object.keys(shape) as (keyof Shape)[],
    updatableKeys,
  };
}

// Common atoms for reuse in entity schemas
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);
export const HttpStatusCodeSchema = z.number().int().min(100).max(599).brand<'HttpStatusCode'>();
