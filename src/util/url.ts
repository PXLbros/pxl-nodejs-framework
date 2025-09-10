const buildQueryString = (params: { [key: string]: string | number | boolean }): string => {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
};

export default {
  buildQueryString,
};
