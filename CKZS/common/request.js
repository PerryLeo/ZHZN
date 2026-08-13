// common/request.js
// HTTP 请求封装 — 便于调试，自动注入 Token，统一错误处理
import { API_BASE_URL, TOKEN_KEY } from './config.js';

const DEBUG = true; // 上线后可改为 false 关闭调试日志

// --------------- 日志工具 ---------------
const log = {
  request(method, url, data, headers) {
    if (!DEBUG) return;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📤 ${method} ${url}`);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body:', JSON.stringify(data, null, 2));
  },
  response(url, res) {
    if (!DEBUG) return;
    console.log(`📥 Response [${res.statusCode}] ${url}`);
    console.log('Data:', JSON.stringify(res.data, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  },
  error(url, err) {
    console.log(`❌ Error ${url}`);
    console.log('Detail:', JSON.stringify(err, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  },
};

// --------------- 请求核心 ---------------
const request = (method, url, data, options = {}) => {
  const fullUrl = API_BASE_URL + url;
  const token = uni.getStorageSync(TOKEN_KEY) || '';

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  log.request(method, fullUrl, data, headers);

  return new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      header: headers,
      timeout: options.timeout || 15000,
      success: (res) => {
        log.response(fullUrl, res);

        const { statusCode, data: body } = res;

        // Token 过期 / 未登录
        if (statusCode === 401 || body?.code === 401) {
          uni.removeStorageSync(TOKEN_KEY);
          uni.removeStorageSync('USER_INFO');
          const pages = getCurrentPages();
          const current = pages[pages.length - 1]?.route;
          if (current && !current.includes('login/')) {
            uni.showToast({ title: '登录已过期，请重新登录', icon: 'none', duration: 2000 });
            setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 1500);
          }
          reject(body.message || 'Token 已过期');
          return;
        }

        // HTTP 状态码异常
        if (statusCode < 200 || statusCode >= 300) {
          const msg = `HTTP ${statusCode}: ${body?.message || '服务器异常'}`;
          reject(msg);
          return;
        }

        // 业务码成功
        if (body && body.code === 0) {
          resolve(body.data);
          return;
        }

        // 其他业务错误
        reject(body?.message || '请求失败');
      },
      fail: (err) => {
        log.error(fullUrl, err);
        reject(err.errMsg || '网络不可用，请检查连接');
      },
    });
  });
};

// --------------- 对外方法 ---------------
const http = {
  get: (url, params, opts) => request('GET', url, params, opts),
  post: (url, data, opts) => request('POST', url, data, opts),
  put: (url, data, opts) => request('PUT', url, data, opts),
  delete: (url, data, opts) => request('DELETE', url, data, opts),
};

export { API_BASE_URL };
export default http;
