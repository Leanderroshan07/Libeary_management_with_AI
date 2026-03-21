import axios from 'axios';

const normalizeBaseUrl = (baseUrl) => String(baseUrl || '').replace(/\/+$/, '');

const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
const defaultProdBaseUrl = normalizeBaseUrl(import.meta.env.VITE_FALLBACK_API_BASE_URL);
const isDev = import.meta.env.DEV;

const fallbackBaseUrls = [
    configuredBaseUrl,
    !isDev ? defaultProdBaseUrl : null,
    isDev ? 'http://localhost:5001' : null,
    isDev ? 'http://localhost:5002' : null,
    isDev ? 'http://localhost:5000' : null
]
    .filter(Boolean)
    .map(normalizeBaseUrl)
    .filter((value, index, array) => array.indexOf(value) === index);

let activeBaseUrl = null;

const orderedBaseUrls = () => {
    if (!activeBaseUrl) {
        return fallbackBaseUrls;
    }

    return [activeBaseUrl, ...fallbackBaseUrls.filter((baseUrl) => baseUrl !== activeBaseUrl)];
};

const isNetworkError = (err) => !err.response;

const requestWithFallback = async (method, path, data, config = {}) => {
    if (!fallbackBaseUrls.length) {
        throw new Error('Backend API URL is not configured. Set VITE_API_BASE_URL in Vercel project settings.');
    }

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
