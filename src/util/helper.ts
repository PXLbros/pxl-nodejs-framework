/**
 * Deep merge two objects safely, preventing prototype pollution.
 */
function defaultsDeep(target: any, ...sources: any[]): any {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      // Skip prototype pollution attempts
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      // Only process own properties to prevent prototype chain access
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        continue;
      }

      const sourceValue = Reflect.get(source, key);
      if (isObject(sourceValue)) {
        if (!Reflect.get(target, key)) {
          Reflect.set(target, key, {});
        }
        defaultsDeep(Reflect.get(target, key), sourceValue);
      } else if (
        Array.isArray(sourceValue) &&
        Array.isArray(Reflect.get(target, key))
      ) {
        const sourceArray = sourceValue;
        const targetArray = Reflect.get(target, key);
        for (let i = 0; i < sourceArray.length; i++) {
          if (sourceArray[i] === undefined && targetArray[i] !== undefined) {
            continue;
          }
          if (isObject(sourceArray[i])) {
            if (typeof targetArray[i] !== 'object') targetArray[i] = {};
            defaultsDeep(targetArray[i], sourceArray[i]);
          } else {
            targetArray[i] = sourceArray[i];
          }
        }
      } else if (!Object.prototype.hasOwnProperty.call(target, key)) {
        Reflect.set(target, key, sourceValue);
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
  return path.split('.').reduce((acc, part) => {
    // Skip prototype pollution attempts
    if (
      part === '__proto__' ||
      part === 'constructor' ||
      part === 'prototype'
    ) {
      return undefined;
    }
    // Only access own properties
    return acc && Object.prototype.hasOwnProperty.call(acc, part)
      ? Reflect.get(acc, part)
      : undefined;
  }, obj);
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
