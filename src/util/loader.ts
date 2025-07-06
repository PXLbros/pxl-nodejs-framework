import fs from 'fs';
import path from 'path';
import { Helper } from './index.js';

const loadModulesInDirectory = async ({
  directory,
  extensions,
}: {
  directory: string;
  extensions?: string[];
}): Promise<{ [key: string]: any }> => {
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

      loadedModules[moduleName] = importedModule.default;
    } catch (error) {
      console.error(`Failed to import module ${filePath}:`, error);
    }
  }

  return loadedModules;
};

const loadEntityModule = async ({ entitiesDirectory, entityName }: { entitiesDirectory: string; entityName: string }): Promise<any> => {
  // Define entity module path
  const entityModulePath = path.join(entitiesDirectory, `${entityName}.${Helper.getScriptFileExtension()}`);

  // Import entity module
  const entityModule = await import(entityModulePath);

  if (!entityModule?.[entityName]) {
    throw new Error(`Entity not found (Entity: ${entityName})`);
  }

  // Get entity class
  const EntityClass = entityModule[entityName];

  return EntityClass;
};

export default {
  loadModulesInDirectory,
  loadEntityModule,
};
