const buildQueryString = (params) => {
    return Object.keys(params)
        .filter((key) => params[key] !== undefined && params[key] !== '')
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
};
export default {
    buildQueryString,
};
//# sourceMappingURL=url.js.map