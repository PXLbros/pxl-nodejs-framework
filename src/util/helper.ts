/**
 * Deep merge two objects safely, preventing prototype pollution.
 */
function defaultsDeep(target: any, ...sources: any[]): any {
  if (!sources.length) return target;
  const source = sources.shift();
  if (isObject(target) && isObject(source)) {
    for (const key of Object.keys(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      const sourceValue = source[key];
      const existing = target[key];
      if (isObject(sourceValue)) {
        target[key] = isObject(existing) ? existing : {};
        defaultsDeep(target[key], sourceValue);
      } else if (Array.isArray(sourceValue) && Array.isArray(existing)) {
        for (let i = 0; i < sourceValue.length; i++) {
          if (sourceValue[i] === undefined && existing[i] !== undefined) continue;
          if (isObject(sourceValue[i])) {
            existing[i] = isObject(existing[i]) ? existing[i] : {};
            defaultsDeep(existing[i], sourceValue[i]);
          } else {
            existing[i] = sourceValue[i];
          }
        }
      } else if (!(key in target)) {
        target[key] = sourceValue;
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
 * Retrieves the value from an object using a dotted key path safely.
 *
 * @param obj - The object to retrieve the value from.
 * @param path - The dotted key path (e.g., 'user.email').
 * @returns The value at the specified key path or undefined if not found.
 */
function getValueFromObject(obj: AnyObject, path: string): any {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') return undefined;
    if (!current || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = current[part];
  }
  return current;
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
