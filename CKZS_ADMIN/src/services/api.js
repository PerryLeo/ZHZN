import { clearSession, getToken } from './auth.js';

const toQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, value);
  });
  const result = query.toString();
  return result ? `?${result}` : '';
};

const request = async (path, options = {}) => {
  const token = getToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));

  if (response.status === 401 || body.code === 401) {
    clearSession();
    if (!path.endsWith('/login')) window.location.assign(`${import.meta.env.BASE_URL}login`);
    throw new Error(body.message || '登录已过期，请重新登录');
  }
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || `请求失败（${response.status}）`);
  }
  return body.data;
};

export const api = {
  get: (path, params) => request(`${path}${toQuery(params)}`),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
