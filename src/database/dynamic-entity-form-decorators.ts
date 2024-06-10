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
  const prototype = model.prototype;

  for (const propertyKey of Object.getOwnPropertyNames(prototype)) {
    const formFieldType = Reflect.getMetadata('custom:formFieldType', prototype, propertyKey);
    const formFieldLabel = Reflect.getMetadata('custom:formFieldLabel', prototype, propertyKey);
    const formFieldPlaceholder = Reflect.getMetadata('custom:formFieldPlaceholder', prototype, propertyKey);

    if (formFieldType && formFieldLabel) {
      formFields.push({
        name: propertyKey,
        type: formFieldType,
        label: formFieldLabel,
        placeholder: formFieldPlaceholder,
      });
    }
  }

  return formFields;
};
