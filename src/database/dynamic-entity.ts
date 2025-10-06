import { BaseEntity } from '@mikro-orm/core';
import { z } from 'zod';

export abstract class DynamicEntity extends BaseEntity {
  public static schema: z.ZodSchema;
  public static schemaUpdate: z.ZodSchema;

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

  public static validate<T>(item: T, isCreating: boolean): { error?: Error; value?: T } {
    const schemaName = isCreating ? 'schema' : 'schemaUpdate';
    // Explicit whitelist of schema properties to prevent object injection
    if (!['schema', 'schemaUpdate'].includes(schemaName)) {
      throw new Error('Invalid schema reference');
    }
    const selectedSchema: z.ZodSchema | undefined = schemaName === 'schema' ? this.schema : this.schemaUpdate;
    if (!selectedSchema) {
      throw new Error('Schema not defined in entity.');
    }

    try {
      const value = selectedSchema.parse(item);
      return { value: value as T };
    } catch (err) {
      if (err instanceof z.ZodError) {
        const error = new Error(err.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', '));
        return { error };
      }
      return { error: err as Error };
    }
  }

  public static getSearchFields(): string[] {
    return [];
  }
}
