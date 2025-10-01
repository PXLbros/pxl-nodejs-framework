import lodashDefaultsDeep from 'lodash.defaultsdeep';

/**
 * Deep merge objects with defaults, preventing prototype pollution.
 *
 * This is a secure wrapper around lodash.defaultsdeep that:
 * - Sanitizes sources to remove dangerous keys (__proto__, constructor, prototype)
 * - Delegates to battle-tested lodash.defaultsdeep for merge logic
 * - Maintains backward compatibility with existing usage
 *
 * @param target - The target object to merge into
 * @param sources - Source objects providing default values
 * @returns The merged target object (mutated)
 *
 * @example
 * const userConfig = { host: 'localhost' };
 * const defaults = { host: '0.0.0.0', port: 3001 };
 * const merged = defaultsDeep(userConfig, defaults);
 * // merged = { host: 'localhost', port: 3001 }
 */
function defaultsDeep(target: any, ...sources: any[]): any {
  // Sanitize sources to prevent prototype pollution
  const sanitizedSources = sources.map(source => {
    if (!isObject(source)) return source;

    const sanitized = { ...source };
    delete sanitized['__proto__'];
    delete sanitized['constructor'];
    delete sanitized['prototype'];
    return sanitized;
  });

  // Delegate to lodash.defaultsdeep with sanitized sources
  return lodashDefaultsDeep(target, ...sanitizedSources);
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
