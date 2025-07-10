import { BaseEntity } from '@mikro-orm/core';
import { Schema, ValidationResult } from 'joi';

export abstract class DynamicEntity extends BaseEntity {
  public static schema: Schema;
  public static schemaUpdate: Schema;

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
    return (
      this.singularName.charAt(0).toUpperCase() +
      this.singularName.slice(1).toLowerCase()
    );
  }

  public static get pluralNameCapitalized(): string {
    return (
      this.pluralName.charAt(0).toUpperCase() +
      this.pluralName.slice(1).toLowerCase()
    );
  }

  public static validate<T>(item: T, isCreating: boolean): ValidationResult {
    const schemaName = isCreating ? 'schema' : 'schemaUpdate';

    if (!this[schemaName]) {
      throw new Error('Schema not defined in entity.');
    }

    return this[schemaName].validate(item, { abortEarly: false });
  }

  public static getSearchFields(): string[] {
    return [];
  }
}
