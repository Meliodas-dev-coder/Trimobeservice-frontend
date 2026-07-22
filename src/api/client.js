// Thin fetch wrapper around the Trimobe REST API.
//
// - Base URL comes from VITE_API_URL (defaults to /api/v1, which the Vite dev
//   server proxies to the Go backend).
// - Attaches the Bearer access token when available.
// - Normalizes the backend's { error, details } body into an ApiError.
// - On a 401 it asks the registered handler (the auth store) to refresh the
//   token, then retries the request once.
//
// The access token and refresh handler are injected from the auth store to keep
// this module free of a circular import.

export const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

let accessToken = null;
let refreshHandler = null; // async () => newAccessToken | null

export function setAccessToken(token) {
  accessToken = token || null;
}

export function setRefreshHandler(fn) {
  refreshHandler = fn;
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details || null;
  }
}

function buildURL(path, params) {
  const url = `${BASE_URL}${path}`;
  if (!params) {
    return url;
  }
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.append(key, value);
    }
  }
  const search = qs.toString();
  return search ? `${url}?${search}` : url;
}

async function send(method, path, { body, params, auth = true, headers = {} } = {}) {
  const opts = { method, headers: { Accept: 'application/json', ...headers } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (auth && accessToken) {
    opts.headers.Authorization = `Bearer ${accessToken}`;
  }
  return fetch(buildURL(path, params), opts);
}

async function parse(res) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && data.error) || res.statusText || 'Request failed';
    throw new ApiError(res.status, message, data && data.details);
  }
  return data;
}

async function authenticatedFetch(path, options = {}, retry = true) {
  const headers = { Accept: '*/*', ...(options.headers || {}) };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  let res = await fetch(buildURL(path, options.params), { ...options, headers });
  if (res.status === 401 && retry && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      accessToken = newToken;
      res = await authenticatedFetch(path, options, false);
    }
  }
  return res;
}

async function request(method, path, options = {}) {
  let res = await send(method, path, options);

  if (res.status === 401 && options.auth !== false && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      accessToken = newToken;
      res = await send(method, path, options); // retry once with the fresh token
    }
  }

  return parse(res);
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  del: (path, options) => request('DELETE', path, options),
};

// uploadFile POSTs multipart form data (e.g. an image) with the same Bearer +
// refresh-on-401 handling as request(). The browser sets the multipart
// Content-Type/boundary, so we must not set it ourselves.
export async function uploadFile(path, formData) {
  const doFetch = () =>
    fetch(buildURL(path), {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: formData,
    });

  let res = await doFetch();
  if (res.status === 401 && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      accessToken = newToken;
      res = await doFetch();
    }
  }
  return parse(res);
}

// Fetch a non-JSON response (CSV, PDF, or another protected attachment) with
// the same token refresh behaviour as the JSON client. Keeping this here avoids
// exposing the access token to feature modules and prevents download links from
// losing authentication when opened directly by the browser.
export async function downloadFile(path, { params, headers } = {}) {
  const res = await authenticatedFetch(path, { method: 'GET', params, headers });
  if (!res.ok) {
    return parse(res);
  }
  const disposition = res.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quoted = disposition.match(/filename="([^"]+)"/i)?.[1];
  return {
    blob: await res.blob(),
    filename: encoded ? decodeURIComponent(encoded) : quoted || '',
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  };
}
