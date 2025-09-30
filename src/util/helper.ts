/**
 * Deep merge two objects safely, preventing prototype pollution.
 *
 * Notes:
 * - Keys are enumerated via Object.keys(source) (no prototype chain traversal)
 * - Prototype pollution vectors (__proto__, constructor, prototype) are skipped
 * - All dynamic property writes are confined to caller-provided plain objects
 * - security/detect-object-injection warnings are suppressed for the controlled region
 */
/* eslint-disable security/detect-object-injection */
function defaultsDeep(target: any, ...sources: any[]): any {
  if (!sources.length) return target;
  const source = sources.shift();
  if (isObject(target) && isObject(source)) {
    for (const key of Object.keys(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      const sourceValue = (source as Record<string, any>)[key];
      const existing = (target as Record<string, any>)[key];
      if (isObject(sourceValue)) {
        (target as Record<string, any>)[key] = isObject(existing) ? existing : {};
        defaultsDeep((target as Record<string, any>)[key], sourceValue);
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
        (target as Record<string, any>)[key] = sourceValue;
      }
    }
  }
  return defaultsDeep(target, ...sources);
}
/* eslint-enable security/detect-object-injection */

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
    // Access guarded by ownProperty check and blocked prototype keys
    // eslint-disable-next-line security/detect-object-injection
    current = (current as Record<string, any>)[part];
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
  return process.env.NODE_ENV === 'development' ? 'ts' : 'js';
}

export default {
  defaultsDeep,
  isObject,
  getValueFromArray,
  getValueFromObject,
  getScriptFileExtension,
};
