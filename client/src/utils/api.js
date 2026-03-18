import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;

const fallbackBaseUrls = [
    configuredBaseUrl,
    'http://localhost:5001',
    'http://localhost:5002',
    'http://localhost:5000'
].filter(Boolean);

let activeBaseUrl = null;

const orderedBaseUrls = () => {
    if (!activeBaseUrl) {
        return fallbackBaseUrls;
    }

    return [activeBaseUrl, ...fallbackBaseUrls.filter((baseUrl) => baseUrl !== activeBaseUrl)];
};

const isNetworkError = (err) => !err.response;

const requestWithFallback = async (method, path, data, config = {}) => {
    let lastNetworkError = null;

    for (const baseUrl of orderedBaseUrls()) {
        try {
            const response = await axios({
                method,
                url: `${baseUrl}${path}`,
                data,
                ...config
            });
            activeBaseUrl = baseUrl;
            return response;
        } catch (err) {
            if (!isNetworkError(err)) {
                throw err;
            }
            lastNetworkError = err;
        }
    }

    throw lastNetworkError || new Error('Unable to connect to backend API');
};

export const apiGet = (path, config) => requestWithFallback('get', path, undefined, config);
export const apiPost = (path, data, config) => requestWithFallback('post', path, data, config);
export const apiPut = (path, data, config) => requestWithFallback('put', path, data, config);
export const apiPatch = (path, data, config) => requestWithFallback('patch', path, data, config);
export const apiDelete = (path, config) => requestWithFallback('delete', path, undefined, config);

export const buildBackendUrl = (path) => {
    const baseUrl = activeBaseUrl || fallbackBaseUrls[0];
    return `${baseUrl}${path}`;
};
