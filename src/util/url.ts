const buildQueryString = (params: { [key: string]: string | number | boolean }): string => {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
};

export default {
  buildQueryString,
};
