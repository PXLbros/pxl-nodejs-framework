import { BaseEntity } from '@mikro-orm/core';
import { Schema, ValidationResult } from 'joi';
export declare abstract class DynamicEntity extends BaseEntity {
    static schema: Schema;
    static schemaUpdate: Schema;
    static get singularName(): string;
    static get pluralName(): string;
    static get singularNameLowerCase(): string;
    static get pluralNameLowerCase(): string;
    static get singularNameCapitalized(): string;
    static get pluralNameCapitalized(): string;
    static validate<T>(item: T, isCreating: boolean): ValidationResult;
    static getSearchFields(): string[];
}
//# sourceMappingURL=dynamic-entity.d.ts.map