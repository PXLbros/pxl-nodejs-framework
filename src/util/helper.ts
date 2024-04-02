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

function isObject(item: any): boolean {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

export default {
  defaultsDeep,
  isObject,
}
