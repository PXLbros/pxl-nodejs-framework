import { BaseEntity } from '@mikro-orm/core';
export class DynamicEntity extends BaseEntity {
    static schema;
    static schemaUpdate;
    static get singularName() {
        return 'Item';
    }
    static get pluralName() {
        return 'Items';
    }
    static get singularNameLowerCase() {
        return this.singularName.toLowerCase();
    }
    static get pluralNameLowerCase() {
        return this.pluralName.toLowerCase();
    }
    static get singularNameCapitalized() {
        return this.singularName.charAt(0).toUpperCase() + this.singularName.slice(1).toLowerCase();
    }
    static get pluralNameCapitalized() {
        return this.pluralName.charAt(0).toUpperCase() + this.pluralName.slice(1).toLowerCase();
    }
    static validate(item, isCreating) {
        const schemaName = isCreating ? 'schema' : 'schemaUpdate';
        if (!this[schemaName]) {
            throw new Error('Schema not defined in entity.');
        }
        return this[schemaName].validate(item, { abortEarly: false });
    }
    static getSearchFields() { return []; }
}
//# sourceMappingURL=dynamic-entity.js.map