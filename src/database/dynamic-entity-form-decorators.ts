import Joi from 'joi';
import 'reflect-metadata';

export enum FormFieldType {
  Text = 'text',
  Select = 'select',
  Image = 'image',
}

export interface FormFieldOptions {
  type: FormFieldType;
  label: string;
  placeholder?: string;
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
  };
};

export const generateFormFields = ({ model }: { model: any }): FormFieldOptionsExtended[] => {
  const formFields: FormFieldOptionsExtended[] = [];

  const { prototype, schema } = model;

  for (const propertyKey of Object.getOwnPropertyNames(prototype)) {
    const formFieldType = Reflect.getMetadata('custom:formFieldType', prototype, propertyKey);
    const formFieldLabel = Reflect.getMetadata('custom:formFieldLabel', prototype, propertyKey);
    const formFieldPlaceholder = Reflect.getMetadata('custom:formFieldPlaceholder', prototype, propertyKey);

    let validationRules = null;

    if (schema && schema.describe) {
      const schemaDescription = schema.describe();
      const propertySchema = schemaDescription.keys?.[propertyKey];

      if (propertySchema) {
        validationRules = propertySchema;
      }
    }

    if (formFieldType && formFieldLabel) {
      formFields.push({
        name: propertyKey,
        type: formFieldType,
        label: formFieldLabel,
        placeholder: formFieldPlaceholder,
        validation: validationRules,
      });
    }
  }

  return formFields;
};
