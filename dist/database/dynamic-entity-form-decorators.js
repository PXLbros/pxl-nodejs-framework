import 'reflect-metadata';
// @FormField({
//   type: FormFieldType.DynamicInput,
//   label: 'Keywords',
//   typeOptions: { defaultMessage: 'Add Keyword' },
//   typeValues: [{ key: 'keyword', type: FormFieldType.Text, label: 'Keyword' }],
// })
export var FormFieldType;
(function (FormFieldType) {
    FormFieldType["Text"] = "text";
    FormFieldType["Select"] = "select";
    FormFieldType["Image"] = "image";
    FormFieldType["DynamicInput"] = "dynamicInput";
})(FormFieldType || (FormFieldType = {}));
export const FormField = (options) => {
    return (target, propertyKey) => {
        Reflect.defineMetadata('custom:formFieldType', options.type, target, propertyKey);
        Reflect.defineMetadata('custom:formFieldLabel', options.label, target, propertyKey);
        if (options.placeholder) {
            Reflect.defineMetadata('custom:formFieldPlaceholder', options.placeholder, target, propertyKey);
        }
        if (options.typeOptions) {
            Reflect.defineMetadata('custom:formFieldTypeOptions', options.typeOptions, target, propertyKey);
        }
        if (options.typeValues) {
            Reflect.defineMetadata('custom:formFieldTypeValues', options.typeValues, target, propertyKey);
        }
    };
};
export const generateFormFields = ({ model }) => {
    const formFields = [];
    const { prototype, schema } = model;
    for (const propertyKey of Object.getOwnPropertyNames(prototype)) {
        const formFieldType = Reflect.getMetadata('custom:formFieldType', prototype, propertyKey);
        const formFieldLabel = Reflect.getMetadata('custom:formFieldLabel', prototype, propertyKey);
        const formFieldPlaceholder = Reflect.getMetadata('custom:formFieldPlaceholder', prototype, propertyKey);
        const formFieldTypeOptions = Reflect.getMetadata('custom:formFieldTypeOptions', prototype, propertyKey);
        const formFieldTypeValues = Reflect.getMetadata('custom:formFieldTypeValues', prototype, propertyKey);
        let validationRules = null;
        // if (schema && schema.describe) {
        //   const schemaDescription = schema.describe();
        //   const propertySchema = schemaDescription.keys?.[propertyKey];
        //   if (propertySchema) {
        //     validationRules = propertySchema;
        //   }
        // }
        if (formFieldType && formFieldLabel) {
            formFields.push({
                name: propertyKey,
                type: formFieldType,
                label: formFieldLabel,
                placeholder: formFieldPlaceholder,
                validation: validationRules,
                typeOptions: formFieldTypeOptions,
                typeValues: formFieldTypeValues,
            });
        }
    }
    return formFields;
};
//# sourceMappingURL=dynamic-entity-form-decorators.js.map