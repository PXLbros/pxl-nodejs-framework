import { BaseEntity } from '@mikro-orm/core';
import { z } from 'zod';
import { buildEntitySchemas } from '../schemas/entity-builder.js';

export abstract class DynamicEntity extends BaseEntity {
  /** Required fields for creating a new entity */
  public static createSchema: z.ZodSchema;
  /** Allowed (partial) fields for updating an entity */
  public static updateSchema: z.ZodSchema;
  /** Optional projection/read schema (includes persistence augment) */
  public static readSchema?: z.ZodSchema;

  public static get singularName(): string {
    return 'Item';
  }

  public static get pluralName(): string {
    return 'Items';
  }

  public static get singularNameLowerCase(): string {
    return this.singularName.toLowerCase();
  }

  public static get pluralNameLowerCase(): string {
    return this.pluralName.toLowerCase();
  }

  public static get singularNameCapitalized(): string {
    return this.singularName.charAt(0).toUpperCase() + this.singularName.slice(1).toLowerCase();
  }

  public static get pluralNameCapitalized(): string {
    return this.pluralName.charAt(0).toUpperCase() + this.pluralName.slice(1).toLowerCase();
  }

  public static validateCreate<T>(item: unknown): { error?: Error; value?: T } {
    try {
      return { value: this.createSchema.parse(item) as T };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return { error: new Error(err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')) };
      }
      return { error: err as Error };
    }
  }

  public static validateUpdate<T>(item: unknown): { error?: Error; value?: T } {
    try {
      return { value: this.updateSchema.parse(item) as T };
    } catch (err) {
      if (err instanceof z.ZodError) {
        return { error: new Error(err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')) };
      }
      return { error: err as Error };
    }
  }

  public static getSearchFields(): string[] {
    return [];
  }

  public static defineSchemas<Shape extends z.ZodRawShape, Updatable extends readonly (keyof Shape)[]>(options: {
    shape: Shape;
    updatableFields?: Updatable;
    requireAtLeastOneOnUpdate?: boolean;
    readAugment?: z.ZodRawShape;
  }): void {
    const { shape, updatableFields, requireAtLeastOneOnUpdate = true, readAugment } = options;
    const schemas = buildEntitySchemas({
      shape,
      updatableFields: updatableFields as any,
      requireAtLeastOneOnUpdate,
      readAugment,
    });
    this.createSchema = schemas.create;
    this.updateSchema = schemas.update;
    if (readAugment) {
      this.readSchema = schemas.read;
    }
  }
}
