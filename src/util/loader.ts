import fs from 'fs';
import path from 'path';
import { Helper } from './index.js';

// Cache for loaded modules to avoid repeated imports
const moduleCache = new Map<string, { [key: string]: any }>();
const entityCache = new Map<string, any>();

const loadModulesInDirectory = async ({
  directory,
  extensions,
}: {
  directory: string;
  extensions?: string[];
}): Promise<{ [key: string]: any }> => {
  // Create cache key based on directory and extensions
  const cacheKey = `${directory}:${extensions?.join(',') ?? 'all'}`;

  // Check cache first
  if (moduleCache.has(cacheKey)) {
    const cachedModule = moduleCache.get(cacheKey);
    if (cachedModule) {
      return cachedModule;
    }
  }

  const loadedModules: { [key: string]: any } = {};

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

    try {
      const importedModule = await import(filePath);

      // Use safe property assignment to prevent prototype pollution
      if (moduleName !== '__proto__' && moduleName !== 'constructor' && moduleName !== 'prototype') {
        Reflect.set(loadedModules, moduleName, importedModule.default);
      }
    } catch (error) {
      console.error(`Failed to import module ${filePath}:`, error);
    }
  }

  // Cache the results for future use
  moduleCache.set(cacheKey, loadedModules);

  return loadedModules;
};

const loadEntityModule = async ({
  entitiesDirectory,
  entityName,
}: {
  entitiesDirectory: string;
  entityName: string;
}): Promise<any> => {
  // Create cache key based on directory and entity name
  const cacheKey = `${entitiesDirectory}:${entityName}`;

  // Check cache first
  if (entityCache.has(cacheKey)) {
    return entityCache.get(cacheKey);
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
