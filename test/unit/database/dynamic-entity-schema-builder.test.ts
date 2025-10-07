import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { DynamicEntity } from '../../../src/database/dynamic-entity';
import { HttpMethodSchema, HttpStatusCodeSchema } from '../../../src/schemas/entity-builder';

// Example entity using new pattern
class ExternalCallEntity extends DynamicEntity {
  static {
    this.defineSchemas({
      shape: {
        serviceName: z.string(),
        method: HttpMethodSchema,
        endpoint: z.string(),
        externalApiUrl: z.string().url(),
        statusCode: HttpStatusCodeSchema,
        durationMs: z.number().int().min(0),
        errorMessage: z.string().optional(),
      },
      updatableFields: ['statusCode', 'durationMs', 'errorMessage'] as const,
    });
  }
}

describe('DynamicEntity schema improvements', () => {
  it('validates create with required fields', () => {
    const { value, error } = ExternalCallEntity.validateCreate({
      serviceName: 'svc',
      method: 'GET',
      endpoint: '/x',
      externalApiUrl: 'https://example.com',
      statusCode: 200,
      durationMs: 5,
    });
    expect(error).toBeUndefined();
    expect(value).toBeDefined();
  });

  it('rejects create missing required', () => {
    const { error } = ExternalCallEntity.validateCreate({ statusCode: 200 } as any);
    expect(error).toBeInstanceOf(Error);
  });

  it('accepts partial update with allowed field', () => {
    const { error, value } = ExternalCallEntity.validateUpdate({ statusCode: 201 });
    expect(error).toBeUndefined();
    expect(value).toEqual({ statusCode: 201 });
  });

  it('rejects empty update object', () => {
    const { error } = ExternalCallEntity.validateUpdate({});
    expect(error).toBeInstanceOf(Error);
  });
});
