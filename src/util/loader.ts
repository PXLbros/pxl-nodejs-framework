import fs from 'fs';
import path from 'path';
import { LRUCache } from 'lru-cache';
import { Helper } from './index.js';

// Type for a map of loaded modules
export interface ModuleMap<T = unknown> {
  [key: string]: T;
}

// Cache for loaded modules to avoid repeated imports
// Using LRU cache to prevent unbounded memory growth in long-running processes
const moduleCache = new LRUCache<string, ModuleMap>({
  max: 100, // Max 100 directories cached
  ttl: 1000 * 60 * 10, // 10 minutes
});

const entityCache = new LRUCache<string, EntityClass>({
  max: 500, // Max 500 entities cached (accessed more frequently than modules)
  ttl: 1000 * 60 * 10, // 10 minutes
});

const loadModulesInDirectory = async <T = unknown>({
  directory,
  extensions,
}: {
  directory: string;
  extensions?: string[];
}): Promise<ModuleMap<T>> => {
  // Create cache key based on directory and extensions
  const cacheKey = `${directory}:${extensions?.join(',') ?? 'all'}`;

  // Check cache first
  if (moduleCache.has(cacheKey)) {
    const cachedModule = moduleCache.get(cacheKey);
    if (cachedModule) {
      return cachedModule as ModuleMap<T>;
    }
  }

  const loadedModules: ModuleMap<T> = {};

  // Use readdir with withFileTypes option to avoid separate stat calls
  const dirents = await fs.promises.readdir(directory, { withFileTypes: true });

  for (const dirent of dirents) {
    // Skip directories without needing stat call
    if (dirent.isDirectory()) {
      continue;
    }

    const file = dirent.name;
    const ext = path.extname(file);
    const isDeclarationFile = file.endsWith('.d.ts');

    // Skip files that are not in the specified extensions or are .d.ts files
    if ((extensions && extensions.length > 0 && !extensions.includes(ext)) || isDeclarationFile) {
      continue;
    }

    const moduleName = path.basename(file, ext);
    const filePath = path.join(directory, file);
    // Convert to absolute path for ESM import
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    // Use file:// URL for Windows compatibility
    const fileUrl = `file://${absolutePath.replace(/\\/g, '/')}`;

    try {
      const importedModule = await import(fileUrl);

      // Use safe property assignment to prevent prototype pollution
      if (moduleName !== '__proto__' && moduleName !== 'constructor' && moduleName !== 'prototype') {
        // Prefer default export, but fall back to the entire module if no default
        const moduleExport = importedModule.default ?? importedModule;
        Reflect.set(loadedModules, moduleName, moduleExport);
      }
    } catch (error) {
      console.error(`Failed to import module ${filePath}:`, error);
    }
  }

  // Cache the results for future use
  moduleCache.set(cacheKey, loadedModules);

  return loadedModules;
};

// Type constraint for entity classes (must be constructable)
export type EntityClass<T = unknown> = new (...args: unknown[]) => T;

const loadEntityModule = async <T = unknown>({
  entitiesDirectory,
  entityName,
}: {
  entitiesDirectory: string;
  entityName: string;
}): Promise<EntityClass<T>> => {
  // Create cache key based on directory and entity name
  const cacheKey = `${entitiesDirectory}:${entityName}`;

  // Check cache first
  if (entityCache.has(cacheKey)) {
    return entityCache.get(cacheKey) as EntityClass<T>;
  }

  // Define entity module path
  const entityModulePath = path.join(entitiesDirectory, `${entityName}.${Helper.getScriptFileExtension()}`);

  // Import entity module
  const entityModule = await import(entityModulePath);

  // Safe property access to prevent prototype pollution
  if (entityName === '__proto__' || entityName === 'constructor' || entityName === 'prototype') {
    throw new Error(`Invalid entity name (Entity: ${entityName})`);
  }

  if (!entityModule || !Object.prototype.hasOwnProperty.call(entityModule, entityName)) {
    throw new Error(`Entity not found (Entity: ${entityName})`);
  }

  // Get entity class
  const EntityClass = Reflect.get(entityModule, entityName);

  // Cache the entity for future use
  entityCache.set(cacheKey, EntityClass);

  return EntityClass;
};

// Cache management functions for development/testing
const clearModuleCache = (): void => {
  moduleCache.clear();
  entityCache.clear();
};

const getCacheStats = (): { modulesCached: number; entitiesCached: number } => {
  return {
    modulesCached: moduleCache.size,
    entitiesCached: entityCache.size,
  };
};

export default {
  loadModulesInDirectory,
  loadEntityModule,
  clearModuleCache,
  getCacheStats,
};
