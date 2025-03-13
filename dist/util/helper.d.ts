/**
 * Deep merge two objects.
 */
declare function defaultsDeep(target: any, ...sources: any[]): any;
/**
 * Check if a value is an object.
 */
declare function isObject(item: any): boolean;
type AnyObject = {
    [key: string]: any;
};
/**
 * Retrieves the value from an object using a dotted key path.
 *
 * @param obj - The object to retrieve the value from.
 * @param path - The dotted key path (e.g., 'user.email').
 * @returns The value at the specified key path or undefined if not found.
 */
declare function getValueFromObject(obj: AnyObject, path: string): any;
/**
 * Retrieves the value from an array of objects using a dotted key path.
 *
 * @param arr - The array of objects.
 * @param path - The dotted key path (e.g., 'user.email').
 * @returns An array of values at the specified key path from each object.
 */
declare function getValueFromArray(arr: AnyObject[], path: string): any[];
declare function getScriptFileExtension(): string;
declare const _default: {
    defaultsDeep: typeof defaultsDeep;
    isObject: typeof isObject;
    getValueFromArray: typeof getValueFromArray;
    getValueFromObject: typeof getValueFromObject;
    getScriptFileExtension: typeof getScriptFileExtension;
};
export default _default;
//# sourceMappingURL=helper.d.ts.map