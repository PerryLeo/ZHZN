// common/api.js
// API 请求封装 — 自动注入 JWT Token，统一处理 401 过期
import { API_BASE_URL, TOKEN_KEY } from './config.js';

const request = (method, url, data) => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(TOKEN_KEY) || '';

    uni.request({
      url: API_BASE_URL + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      success: (res) => {
        const body = res.data;
        // 后端统一格式 { code: 0, message, data }
        if (body.code === 0) {
          resolve(body.data);
        } else {
          // 401 未登录 / Token 过期
          if (res.statusCode === 401 || body.code === 401) {
            uni.removeStorageSync(TOKEN_KEY);
            uni.removeStorageSync('USER_INFO');
            // 跳转登录页（非登录页才跳）
            const pages = getCurrentPages();
            const current = pages[pages.length - 1]?.route;
            if (current && !current.includes('login/login') && !current.includes('login/register')) {
              uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
              uni.reLaunch({ url: '/pages/login/login' });
            }
          }
          reject(body.message || '请求失败');
        }
      },
      fail: (err) => {
        reject(err.errMsg || '网络连接失败');
      },
    });
  });
};

const api = {
  get: (url, params) => request('GET', url, params),
  post: (url, data) => request('POST', url, data),
};

export default api;
