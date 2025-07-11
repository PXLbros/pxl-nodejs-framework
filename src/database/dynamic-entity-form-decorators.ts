import type Joi from 'joi';
import 'reflect-metadata';

// @FormField({
//   type: FormFieldType.DynamicInput,
//   label: 'Keywords',
//   typeOptions: { defaultMessage: 'Add Keyword' },
//   typeValues: [{ key: 'keyword', type: FormFieldType.Text, label: 'Keyword' }],
// })

export enum FormFieldType {
  Text = 'text',
  Select = 'select',
  Image = 'image',
  DynamicInput = 'dynamicInput',
}

export interface FormFieldOptions {
  type: FormFieldType;
  label: string;
  placeholder?: string;
  typeOptions?: any;
  typeValues?: any;
}

export interface FormFieldOptionsExtended extends FormFieldOptions {
  name: string;
  validation: Joi.PartialSchemaMap | null;
}

export const FormField = (options: FormFieldOptions) => {
  return (target: any, propertyKey: string) => {
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

export const generateFormFields = ({ model }: { model: any }): FormFieldOptionsExtended[] => {
  const formFields: FormFieldOptionsExtended[] = [];

  const { prototype } = model;

  for (const propertyKey of Object.getOwnPropertyNames(prototype)) {
    const formFieldType = Reflect.getMetadata('custom:formFieldType', prototype, propertyKey);
    const formFieldLabel = Reflect.getMetadata('custom:formFieldLabel', prototype, propertyKey);
    const formFieldPlaceholder = Reflect.getMetadata('custom:formFieldPlaceholder', prototype, propertyKey);
    const formFieldTypeOptions = Reflect.getMetadata('custom:formFieldTypeOptions', prototype, propertyKey);
    const formFieldTypeValues = Reflect.getMetadata('custom:formFieldTypeValues', prototype, propertyKey);

    const validationRules = null;

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
