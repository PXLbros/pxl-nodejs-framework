import { BaseEntity } from '@mikro-orm/core';
import { Schema, ValidationResult } from 'joi';

export abstract class DynamicEntity extends BaseEntity {
  protected static schema: Schema;

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

  public static validate<T>(item: T): ValidationResult {
    if (!this.schema) {
      throw new Error('Schema not defined in entity.');
    }
    return this.schema.validate(item, { abortEarly: false });
  }
}
