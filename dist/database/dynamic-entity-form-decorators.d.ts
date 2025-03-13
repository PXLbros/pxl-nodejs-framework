import Joi from 'joi';
import 'reflect-metadata';
export declare enum FormFieldType {
    Text = "text",
    Select = "select",
    Image = "image",
    DynamicInput = "dynamicInput"
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
export declare const FormField: (options: FormFieldOptions) => (target: any, propertyKey: string) => void;
export declare const generateFormFields: ({ model }: {
    model: any;
}) => FormFieldOptionsExtended[];
//# sourceMappingURL=dynamic-entity-form-decorators.d.ts.map