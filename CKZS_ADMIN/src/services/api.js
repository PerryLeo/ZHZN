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
  uploadBinary: (path, file) => request(path, { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' } }),
  uploadBinaryProgress: (path, file, onProgress) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    xhr.timeout = 10 * 60 * 1000;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => {
      let body;
      try { body = JSON.parse(xhr.responseText); } catch { reject(new Error(`上传失败（${xhr.status}），请检查服务器上传限制`)); return; }
      if (xhr.status === 401) {
        clearSession();
        window.location.assign(`${import.meta.env.BASE_URL}login`);
      }
      if (xhr.status < 200 || xhr.status >= 300 || body.code !== 0) reject(new Error(body.message || '上传失败'));
      else resolve(body.data);
    };
    xhr.onerror = () => reject(new Error('上传失败，请检查网络'));
    xhr.ontimeout = () => reject(new Error('上传超时，请重试'));
    xhr.send(file);
  }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
