/**
 * Deep merge two objects.
 */
function defaultsDeep(target: any, ...sources: any[]): any {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        defaultsDeep(target[key], source[key]);
      } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
        for (let i = 0; i < source[key].length; i++) {
          if (source[key][i] === undefined && target[key][i] !== undefined) {
            continue;
          }
          if (isObject(source[key][i])) {
            if (typeof target[key][i] !== 'object') target[key][i] = {};
            defaultsDeep(target[key][i], source[key][i]);
          } else {
            target[key][i] = source[key][i];
          }
        }
      } else if (!target.hasOwnProperty(key)) {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return defaultsDeep(target, ...sources);
}

/**
 * Check if a value is an object.
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

type AnyObject = { [key: string]: any };

/**
 * Retrieves the value from an object using a dotted key path.
 *
 * @param obj - The object to retrieve the value from.
 * @param path - The dotted key path (e.g., 'user.email').
 * @returns The value at the specified key path or undefined if not found.
 */
function getValueFromObject(obj: AnyObject, path: string): any {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Retrieves the value from an array of objects using a dotted key path.
 *
 * @param arr - The array of objects.
 * @param path - The dotted key path (e.g., 'user.email').
 * @returns An array of values at the specified key path from each object.
 */
function getValueFromArray(arr: AnyObject[], path: string): any[] {
  return arr.map(obj => getValueFromObject(obj, path));
}

function getScriptFileExtension(): string {
  return process.env.NODE_ENV === 'local' ? 'ts' : 'js';
}

export default {
  defaultsDeep,
  isObject,
  getValueFromArray,
  getValueFromObject,
  getScriptFileExtension,
};
