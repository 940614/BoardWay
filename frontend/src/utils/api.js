import { API_URL } from '../config';

let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

function getFallbackApiUrl() {
  if (API_URL.includes('127.0.0.1')) {
    return API_URL.replace('127.0.0.1', 'localhost');
  }
  if (API_URL.includes('localhost')) {
    return API_URL.replace('localhost', '127.0.0.1');
  }
  return null;
}

async function fetchWithLocalFallback(path, options) {
  try {
    return await fetch(`${API_URL}${path}`, options);
  } catch (error) {
    const fallbackApiUrl = getFallbackApiUrl();
    if (!fallbackApiUrl) throw error;
    return fetch(`${fallbackApiUrl}${path}`, options);
  }
}

export async function apiFetch(path, { token, json, headers, skipAuthHandler, ...rest } = {}) {
  const finalHeaders = { ...(headers || {}) };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let body = rest.body;
  if (json !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  const response = await fetchWithLocalFallback(path, {
    ...rest,
    headers: finalHeaders,
    body,
  });

  if (response.status === 401 && !skipAuthHandler && unauthorizedHandler) {
    try {
      await unauthorizedHandler();
    } catch (error) {
      console.error('Unauthorized handler error', error);
    }
  }

  return response;
}
