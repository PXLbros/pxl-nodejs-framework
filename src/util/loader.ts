import fs from 'fs';
import path from 'path';

const loadModulesInDirectory = async ({
  directory,
  extensions,
}: {
  directory: string;
  extensions?: string[];
}): Promise<{ [key: string]: any }> => {
  const loadedModules: { [key: string]: any } = {};

  const files = await fs.promises.readdir(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = await fs.promises.stat(filePath);

    if (stats.isDirectory()) {
      continue;
    } else if (extensions && extensions.length > 0 && !extensions.includes(path.extname(file))) {
      continue;
    }

    const moduleName = file.replace(/\.(ts|js)$/, '');

    const importedModule = await import(filePath);

    loadedModules[moduleName] = importedModule.default;
  }

  return loadedModules;
};

const loadEntityModule = async ({ entitiesDirectory, entityName }: { entitiesDirectory: string; entityName: string }): Promise<any> => {
  // Define entity module path
  const entityModulePath = path.join(entitiesDirectory, `${entityName}.ts`);

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
