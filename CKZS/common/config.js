// common/config.js
// API 配置常量

// 后端接口基础地址（开发环境）
// Android 模拟器用 10.0.2.2 映射宿主机 localhost
// 真机调试时改为电脑局域网 IP
const API_BASE_URL = 'http://47.236.100.138';

// 本地存储 key
const TOKEN_KEY = 'AUTH_TOKEN';
const USER_KEY = 'USER_INFO';
const SAVED_USERNAME = 'SAVED_USERNAME';
const SAVED_PASSWORD = 'SAVED_PASSWORD';

export { API_BASE_URL, TOKEN_KEY, USER_KEY, SAVED_USERNAME, SAVED_PASSWORD };
