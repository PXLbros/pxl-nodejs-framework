/**
 * Deep merge objects with defaults, preventing prototype pollution.
 *
 * This function:
 * - Recursively merges source objects into the target
 * - Preserves existing values in target (acts like defaults)
 * - Sanitizes sources to remove dangerous keys (__proto__, constructor, prototype)
 * - Prevents prototype pollution attacks
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
function defaultsDeep<T extends object>(target: T, ...sources: Array<Partial<T>>): T {
  // Handle null/undefined target by converting to empty object
  let result = target;
  if (target === null || target === undefined) {
    result = {} as T;
  }

  // Process each source
  for (const source of sources) {
    if (!isObject(source) && !Array.isArray(source)) continue;

    // Recursively merge source into target
    mergeObjects(result, source);
  }

  return result;
}

/**
 * Recursively merge source into target, preserving target values.
 * This acts like defaultsDeep - only fills in missing values from source.
 */
function mergeObjects(target: any, source: any): void {
  // Handle arrays specially - merge by index
  if (Array.isArray(source)) {
    // If target is not an array but source is, treat target as object with numeric keys
    if (!Array.isArray(target)) {
      // Merge array into object-like target
      for (let i = 0; i < source.length; i++) {
        const key = String(i);
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

        // eslint-disable-next-line security/detect-object-injection
        const sourceValue = source[i];
        // eslint-disable-next-line security/detect-object-injection
        const targetValue = target[key];

        // Check if key exists in target
        const keyExists = key in target;

        if (keyExists && isObject(targetValue) && isObject(sourceValue)) {
          mergeObjects(targetValue, sourceValue);
        } else if (!keyExists || targetValue === undefined) {
          // eslint-disable-next-line security/detect-object-injection
          target[key] = isObject(sourceValue) ? deepClone(sourceValue) : sourceValue;
        }
      }
      return;
    }

    // Both are arrays - merge by index
    for (let i = 0; i < source.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const sourceValue = source[i];
      // eslint-disable-next-line security/detect-object-injection
      const targetValue = target[i];

      // Check if index exists in target (not just if value is undefined)
      const indexExists = i in target;

      // If index exists and both values are objects, merge them
      if (indexExists && isObject(targetValue) && isObject(sourceValue)) {
        mergeObjects(targetValue, sourceValue);
      }
      // If index doesn't exist or value is undefined, fill from source
      else if (!indexExists || targetValue === undefined) {
        // eslint-disable-next-line security/detect-object-injection
        target[i] = isObject(sourceValue) ? deepClone(sourceValue) : sourceValue;
      }
      // Otherwise, keep target's existing value
    }
    return;
  }

  // Regular object merging
  for (const key of Object.keys(source)) {
    // Block dangerous keys to prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    // Only use hasOwnProperty for safer property access
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }

    // Access guarded by ownProperty check and blocked prototype keys
    // eslint-disable-next-line security/detect-object-injection
    const sourceValue = source[key];

    // eslint-disable-next-line security/detect-object-injection
    const targetValue = target[key];

    // If both are arrays, merge them by index
    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      mergeObjects(targetValue, sourceValue);
    }
    // If target is object and source is array, merge array into object by numeric keys
    else if (isObject(targetValue) && Array.isArray(sourceValue)) {
      mergeObjects(targetValue, sourceValue);
    }
    // If target value exists and both are objects (not arrays), recurse
    else if (targetValue !== undefined && isObject(targetValue) && isObject(sourceValue)) {
      mergeObjects(targetValue, sourceValue);
    }
    // If target doesn't have this key, set it from source
    else if (targetValue === undefined) {
      // eslint-disable-next-line security/detect-object-injection
      target[key] = isObject(sourceValue) || Array.isArray(sourceValue) ? deepClone(sourceValue) : sourceValue;
    }
    // Otherwise, keep target's existing value (defaultsDeep behavior)
  }
}

/**
 * Deep clone an object to avoid reference sharing.
 */
function deepClone<T>(obj: T): T {
  if (!isObject(obj)) return obj;

  const cloned: any = Array.isArray(obj) ? [] : {};

  for (const key of Object.keys(obj)) {
    // Block dangerous keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    // eslint-disable-next-line security/detect-object-injection
    const value = (obj as any)[key];

    // eslint-disable-next-line security/detect-object-injection
    cloned[key] = isObject(value) ? deepClone(value) : value;
  }

  return cloned;
}

/**
 * Check if a value is an object.
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

type AnyObject = Record<string, unknown>;

/**
 * Retrieves the value from an object using a dotted key path safely.
 *
 * @param obj - The object to retrieve the value from.
 * @param path - The dotted key path (e.g., 'user.email').
 * @returns The value at the specified key path or undefined if not found.
 */
function getValueFromObject(obj: AnyObject, path: string): unknown {
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
function getValueFromArray(arr: AnyObject[], path: string): unknown[] {
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
