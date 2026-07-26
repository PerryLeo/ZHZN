# 登录功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 CKZS uni-app 前端添加登录/注册功能，对接 CKZS_API 后端 JWT 认证。

**Architecture:** 新增 `common/api.js` 封装请求、`common/config.js` 管理配置常量，新增 `pages/login/` 下的登录页和注册页，修改 `App.vue` 实现启动时 token 校验，修改 `pages.json` 注册路由。

**Tech Stack:** uni-app (Vue 3 Composition API), SCSS, uni.request, uni.getStorageSync/setStorageSync

## Global Constraints

- 后端 API 基础路径：`/api`，响应格式 `{ code: 0, message, data }`
- UI 风格严格参照 `pages/index/index.vue`：橙色渐变顶部、白色圆角卡片、渐变圆角按钮
- 使用 `uni.setStorageSync('AUTH_TOKEN', token)` 存储 JWT
- 密码最小长度 6 位（前端 + 后端双重校验）
- 不做"记住密码"、"忘记密码"、第三方登录

---

### Task 1: 创建配置常量文件

**Files:**
- Create: `common/config.js`

**Produces:** `API_BASE_URL`, `TOKEN_KEY` 常量

- [ ] **Step 1: 创建 `common/config.js`**

```js
// common/config.js
// API 配置常量

// 后端接口基础地址（开发环境）
// Android 模拟器用 10.0.2.2 映射宿主机 localhost
// 真机调试时改为电脑局域网 IP
const API_BASE_URL = 'http://10.0.2.2:3000';

// 本地存储 key
const TOKEN_KEY = 'AUTH_TOKEN';
const USER_KEY = 'USER_INFO';

export { API_BASE_URL, TOKEN_KEY, USER_KEY };
```

- [ ] **Step 2: 验证**

在项目任意位置 import 确认路径和语法正确。

---

### Task 2: 创建 API 请求封装

**Files:**
- Create: `common/api.js`

**Consumes:** `API_BASE_URL`, `TOKEN_KEY` from Task 1  
**Produces:** `api.get(url, params)`, `api.post(url, data)` — 返回 Promise

- [ ] **Step 1: 创建 `common/api.js`**

```js
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
```

- [ ] **Step 2: 验证**

确认文件语法正确，import 路径与 Task 1 一致。

---

### Task 3: 创建登录页面

**Files:**
- Create: `pages/login/login.vue`

**Consumes:** `api.post` from Task 2, `TOKEN_KEY`/`USER_KEY` from Task 1  
**Produces:** 登录页面组件，成功后跳转首页

- [ ] **Step 1: 创建登录页面模板**

```vue
<template>
  <view class="page-wrapper">
    <!-- 顶部渐变区域 — 与设备控制中心 mask-content 一致 -->
    <view class="mask-content">
      <view class="brand-area">
        <text class="app-name">智能喂虾机器</text>
        <text class="app-subtitle">欢迎使用</text>
      </view>
    </view>

    <!-- 表单卡片区域 -->
    <view class="form-section">
      <view class="card-box">
        <!-- 用户名 -->
        <view class="input-wrap">
          <text class="input-icon iconfont icon-gerenzhongxin"></text>
          <input
            class="modern-input"
            v-model="username"
            placeholder="请输入用户名"
            placeholder-style="color: #ccc;"
          />
        </view>
        <!-- 密码 -->
        <view class="input-wrap">
          <text class="input-icon iconfont icon-mima"></text>
          <input
            class="modern-input"
            v-model="password"
            type="password"
            placeholder="请输入密码"
            placeholder-style="color: #ccc;"
          />
        </view>
      </view>

      <!-- 登录按钮 -->
      <button class="submit-btn" :disabled="loading" @click="handleLogin">
        {{ loading ? '登录中...' : '登  录' }}
      </button>

      <!-- 注册入口 -->
      <view class="link-area">
        <text class="link-text">还没有账号？</text>
        <text class="link-action" @click="toRegister">立即注册</text>
      </view>
    </view>
  </view>
</template>
```

- [ ] **Step 2: 创建登录页面脚本**

```vue
<script setup>
import { ref } from 'vue';
import api from '@/common/api.js';
import { TOKEN_KEY, USER_KEY } from '@/common/config.js';

const username = ref('');
const password = ref('');
const loading = ref(false);

const handleLogin = async () => {
  const name = username.value.trim();
  const pwd = password.value;
  if (!name || !pwd) {
    return uni.showToast({ title: '请输入账号和密码', icon: 'none' });
  }

  loading.value = true;
  try {
    const data = await api.post('/api/users/login', { username: name, password: pwd });
    // 存储 token 和用户信息
    uni.setStorageSync(TOKEN_KEY, data.token);
    uni.setStorageSync(USER_KEY, JSON.stringify(data.user));
    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' });
    }, 500);
  } catch (err) {
    uni.showToast({ title: typeof err === 'string' ? err : '登录失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const toRegister = () => {
  uni.navigateTo({ url: '/pages/login/register' });
};
</script>
```

- [ ] **Step 3: 创建登录页面样式**

样式完全参照 `pages/index/index.vue`，复用相同的 SCSS 变量和设计规范。

```vue
<style lang="scss" scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #F6F7FB;
  overflow: hidden;
}

/* ===== 顶部渐变区域（与 index.vue mask-content 一致）===== */
.mask-content {
  position: relative;
  z-index: 100;
  flex-shrink: 0;
  padding: 0 30rpx;
  box-sizing: border-box;
  padding-top: calc(var(--status-bar-height) + 40rpx);
  padding-bottom: 80rpx;
  background: radial-gradient(circle at top right, $primary-color, $primary-dark);
  border-radius: 0 0 60rpx 60rpx;
  box-shadow: 0 10rpx 40rpx rgba($primary-color, 0.2);
}

.brand-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 20rpx;

  .app-name {
    font-size: 48rpx;
    font-weight: 700;
    color: #FFFFFF;
    letter-spacing: 2rpx;
    margin-bottom: 16rpx;
  }

  .app-subtitle {
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.8);
  }
}

/* ===== 表单卡片区域 ===== */
.form-section {
  flex: 1;
  padding: 0 40rpx;
  margin-top: -40rpx;
  position: relative;
  z-index: 200;
}

.card-box {
  background-color: #FFFFFF;
  border-radius: 32rpx;
  padding: 50rpx 30rpx 40rpx;
  box-shadow: 0 15rpx 35rpx rgba(0, 0, 0, 0.08);
  margin-bottom: 50rpx;
}

/* ===== 输入框（与 index.vue modern-input 一致）===== */
.input-wrap {
  background: #F6F7FB;
  border-radius: 20rpx;
  padding: 24rpx 30rpx;
  border: 2rpx solid transparent;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  margin-bottom: 30rpx;

  &:last-child {
    margin-bottom: 0;
  }

  &:focus-within {
    border-color: rgba($primary-color, 0.4);
    background: #FFFFFF;
    box-shadow: 0 0 0 6rpx rgba($primary-color, 0.08);
  }

  .input-icon {
    font-size: 36rpx;
    color: #ccc;
    margin-right: 20rpx;
    flex-shrink: 0;
  }

  .modern-input {
    flex: 1;
    font-size: 30rpx;
    color: #333;
  }
}

/* ===== 提交按钮（与 index.vue add-btn 一致）===== */
.submit-btn {
  width: 100%;
  height: 110rpx;
  background: linear-gradient(135deg, $primary-color, $primary-dark);
  color: #FFFFFF;
  border-radius: 55rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 600;
  border: none;
  box-shadow: 0 15rpx 30rpx rgba($primary-color, 0.4);
  margin-bottom: 40rpx;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.7;
  }

  &:active:not([disabled]) {
    opacity: 0.9;
    transform: scale(0.98);
  }
}

/* ===== 底部链接 ===== */
.link-area {
  display: flex;
  justify-content: center;
  align-items: center;

  .link-text {
    font-size: 28rpx;
    color: #999;
  }

  .link-action {
    font-size: 28rpx;
    color: $primary-color;
    font-weight: 600;
    margin-left: 8rpx;
  }
}
</style>
```

---

### Task 4: 创建注册页面

**Files:**
- Create: `pages/login/register.vue`

**Consumes:** `api.post` from Task 2, `TOKEN_KEY`/`USER_KEY` from Task 1  
**Produces:** 注册页面组件，成功后跳转首页

- [ ] **Step 1: 创建注册页面模板**

```vue
<template>
  <view class="page-wrapper">
    <!-- 顶部渐变区域 -->
    <view class="mask-content">
      <view class="brand-area">
        <text class="app-name">创建账号</text>
        <text class="app-subtitle">注册后即可管理您的设备</text>
      </view>
    </view>

    <!-- 表单卡片区域 -->
    <view class="form-section">
      <view class="card-box">
        <!-- 用户名 -->
        <view class="input-wrap">
          <text class="input-icon iconfont icon-gerenzhongxin"></text>
          <input
            class="modern-input"
            v-model="username"
            placeholder="请输入用户名"
            placeholder-style="color: #ccc;"
          />
        </view>
        <!-- 密码 -->
        <view class="input-wrap">
          <text class="input-icon iconfont icon-mima"></text>
          <input
            class="modern-input"
            v-model="password"
            type="password"
            placeholder="请输入密码（至少6位）"
            placeholder-style="color: #ccc;"
          />
        </view>
        <!-- 确认密码 -->
        <view class="input-wrap">
          <text class="input-icon iconfont icon-mima"></text>
          <input
            class="modern-input"
            v-model="confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            placeholder-style="color: #ccc;"
          />
        </view>
      </view>

      <!-- 注册按钮 -->
      <button class="submit-btn" :disabled="loading" @click="handleRegister">
        {{ loading ? '注册中...' : '注  册' }}
      </button>

      <!-- 返回登录 -->
      <view class="link-area">
        <text class="link-text">已有账号？</text>
        <text class="link-action" @click="goBack">返回登录</text>
      </view>
    </view>
  </view>
</template>
```

- [ ] **Step 2: 创建注册页面脚本**

```vue
<script setup>
import { ref } from 'vue';
import api from '@/common/api.js';
import { TOKEN_KEY, USER_KEY } from '@/common/config.js';

const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);

const handleRegister = async () => {
  const name = username.value.trim();
  const pwd = password.value;
  const confirm = confirmPassword.value;

  if (!name || !pwd) {
    return uni.showToast({ title: '请输入账号和密码', icon: 'none' });
  }
  if (pwd.length < 6) {
    return uni.showToast({ title: '密码长度不能少于6位', icon: 'none' });
  }
  if (pwd !== confirm) {
    return uni.showToast({ title: '两次密码输入不一致', icon: 'none' });
  }

  loading.value = true;
  try {
    const data = await api.post('/api/users/register', { username: name, password: pwd });
    uni.setStorageSync(TOKEN_KEY, data.token);
    uni.setStorageSync(USER_KEY, JSON.stringify(data.user));
    uni.showToast({ title: '注册成功', icon: 'success' });
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/index/index' });
    }, 500);
  } catch (err) {
    uni.showToast({ title: typeof err === 'string' ? err : '注册失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  uni.navigateBack();
};
</script>
```

- [ ] **Step 3: 创建注册页面样式**

样式与登录页完全一致，直接复用登录页的 `<style>` 块：

```vue
<style lang="scss" scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #F6F7FB;
  overflow: hidden;
}

.mask-content {
  position: relative;
  z-index: 100;
  flex-shrink: 0;
  padding: 0 30rpx;
  box-sizing: border-box;
  padding-top: calc(var(--status-bar-height) + 40rpx);
  padding-bottom: 80rpx;
  background: radial-gradient(circle at top right, $primary-color, $primary-dark);
  border-radius: 0 0 60rpx 60rpx;
  box-shadow: 0 10rpx 40rpx rgba($primary-color, 0.2);
}

.brand-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 20rpx;

  .app-name {
    font-size: 48rpx;
    font-weight: 700;
    color: #FFFFFF;
    letter-spacing: 2rpx;
    margin-bottom: 16rpx;
  }

  .app-subtitle {
    font-size: 28rpx;
    color: rgba(255, 255, 255, 0.8);
  }
}

.form-section {
  flex: 1;
  padding: 0 40rpx;
  margin-top: -40rpx;
  position: relative;
  z-index: 200;
}

.card-box {
  background-color: #FFFFFF;
  border-radius: 32rpx;
  padding: 50rpx 30rpx 40rpx;
  box-shadow: 0 15rpx 35rpx rgba(0, 0, 0, 0.08);
  margin-bottom: 50rpx;
}

.input-wrap {
  background: #F6F7FB;
  border-radius: 20rpx;
  padding: 24rpx 30rpx;
  border: 2rpx solid transparent;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  margin-bottom: 30rpx;

  &:last-child {
    margin-bottom: 0;
  }

  &:focus-within {
    border-color: rgba($primary-color, 0.4);
    background: #FFFFFF;
    box-shadow: 0 0 0 6rpx rgba($primary-color, 0.08);
  }

  .input-icon {
    font-size: 36rpx;
    color: #ccc;
    margin-right: 20rpx;
    flex-shrink: 0;
  }

  .modern-input {
    flex: 1;
    font-size: 30rpx;
    color: #333;
  }
}

.submit-btn {
  width: 100%;
  height: 110rpx;
  background: linear-gradient(135deg, $primary-color, $primary-dark);
  color: #FFFFFF;
  border-radius: 55rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 600;
  border: none;
  box-shadow: 0 15rpx 30rpx rgba($primary-color, 0.4);
  margin-bottom: 40rpx;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.7;
  }

  &:active:not([disabled]) {
    opacity: 0.9;
    transform: scale(0.98);
  }
}

.link-area {
  display: flex;
  justify-content: center;
  align-items: center;

  .link-text {
    font-size: 28rpx;
    color: #999;
  }

  .link-action {
    font-size: 28rpx;
    color: $primary-color;
    font-weight: 600;
    margin-left: 8rpx;
  }
}
</style>
```

---

### Task 5: 修改 pages.json 注册路由

**Files:**
- Modify: `pages.json`

- [ ] **Step 1: 在 `pages` 数组首位新增 login 和 register 路由**

修改 `pages.json`，在 `pages` 数组最前面插入两个路由：

```json
{
  "pages": [
    {
      "path": "pages/login/login",
      "style": {
        "navigationStyle": "custom"
      }
    },
    {
      "path": "pages/login/register",
      "style": {
        "navigationStyle": "custom"
      }
    },
    {
      "path": "pages/index/index",
      "style": {
        "navigationStyle": "custom",
        "app-plus": {
          "animationType": "none"
        }
      }
    },
    // ... 其余路由保持不变
  ],
  // globalStyle 等其余配置保持不变
}
```

---

### Task 6: 修改 App.vue 添加启动时 Token 校验

**Files:**
- Modify: `App.vue`

**Consumes:** `API_BASE_URL`, `TOKEN_KEY` from Task 1

- [ ] **Step 1: 修改 App.vue 的 onLaunch**

将 `App.vue` 中 `onLaunch` 替换为：

```vue
<script>
import { API_BASE_URL, TOKEN_KEY } from '@/common/config.js';

export default {
  onLaunch: function () {
    // 启动时校验登录状态
    this.checkLoginStatus();
  },
  onShow: function () { },
  onHide: function () { },
  methods: {
    checkLoginStatus() {
      const token = uni.getStorageSync(TOKEN_KEY);
      if (!token) {
        // 无 token，跳转登录页
        uni.reLaunch({ url: '/pages/login/login' });
        return;
      }

      // 有 token，调 profile 接口验证有效性
      uni.request({
        url: API_BASE_URL + '/api/users/profile',
        method: 'GET',
        header: {
          'Authorization': `Bearer ${token}`,
        },
        success: (res) => {
          if (res.data.code === 0) {
            // token 有效
            uni.setStorageSync('USER_INFO', JSON.stringify(res.data.data));
            // 如果当前在登录/注册页，跳转到首页
            const pages = getCurrentPages();
            if (pages.length === 0) return;
            const current = pages[pages.length - 1]?.route;
            if (current && (current.includes('login/login') || current.includes('login/register'))) {
              uni.reLaunch({ url: '/pages/index/index' });
            }
          } else {
            // token 无效
            uni.removeStorageSync(TOKEN_KEY);
            uni.removeStorageSync('USER_INFO');
            uni.reLaunch({ url: '/pages/login/login' });
          }
        },
        fail: () => {
          // 网络错误时不强制跳登录，允许离线使用
          // 仅在当前是登录/注册页时不做额外处理
        },
      });
    },
  },
};
</script>

<style>
/*每个页面公共css */
@import '@/common/font/iconfont.css';
</style>
```

---

### Task 7: 端到端验证

- [ ] **Step 1: 验证启动流程**

重启 App，确认：
1. 首次启动（无 token）→ 自动跳转登录页
2. 登录页输入正确用户名密码 → 登录成功 → 跳转设备控制中心
3. 关闭 App 后重启 → token 有效 → 直接进入设备控制中心
4. 清除 Storage 中 token 后重启 → 重新跳转登录页

- [ ] **Step 2: 验证注册流程**

1. 登录页点击「立即注册」→ 进入注册页
2. 输入已存在的用户名 → 提示"账号已被注册"
3. 输入新用户名 + 有效密码 → 注册成功 → 跳转设备控制中心
4. 注册页点击「返回登录」→ 回到登录页

- [ ] **Step 3: 验证表单校验**

1. 不输入账号密码直接点登录 → 提示"请输入账号和密码"
2. 注册页密码输入少于 6 位 → 提示"密码长度不能少于6位"
3. 注册页两次密码不一致 → 提示"两次密码输入不一致"
4. 输入错误密码 → 提示后端返回的"账号或密码错误"

- [ ] **Step 4: 验证 UI 一致性**

对比登录/注册页与设备控制中心首页：
1. 顶部渐变颜色、圆角一致
2. 卡片阴影、圆角一致
3. 按钮渐变色、圆角、阴影一致
4. 输入框 focus 态效果一致
5. 字体大小、颜色、字重一致
