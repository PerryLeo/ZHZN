# 登录功能设计文档

**日期:** 2026-06-27  
**项目:** CKZS 智能喂虾机器  
**后端:** CKZS_API (Express + JWT + MySQL)

---

## 1. 概述

为 CKZS uni-app 前端添加用户登录/注册功能，对接已有后端 API。App 启动时校验登录状态，未登录则跳转登录页，登录成功后才能进入设备控制中心。

---

## 2. 后端 API（已有，无需改动）

| 接口 | 方法 | 路径 | 请求体 | 响应 data | 认证 |
|------|------|------|--------|-----------|------|
| 登录 | POST | `/api/users/login` | `{username, password}` | `{user, token}` | 否 |
| 注册 | POST | `/api/users/register` | `{username, password}` | `{user, token}` | 否 |
| 用户信息 | GET | `/api/users/profile` | — | `{id, username, ...}` | Bearer Token |

统一响应格式：`{ code: 0, message: "ok", data: {...} }`

---

## 3. 页面流程

```
App 启动 (App.vue onLaunch)
  │
  ├─ 无 token ──→ redirectTo: pages/login/login
  │
  └─ 有 token ──→ GET /api/users/profile
                    │
                    ├─ 200 ──→ 正常进入首页 (pages/index/index)
                    │
                    └─ 401 ──→ 清除 token → redirectTo: pages/login/login

登录页 (pages/login/login)
  │
  ├─ 输入 username + password
  ├─ POST /api/users/login
  │   ├─ 成功 → 存储 token → redirectTo: pages/index/index
  │   └─ 失败 → 提示错误信息
  │
  └─ 点击「注册」→ navigateTo: pages/login/register

注册页 (pages/login/register)
  │
  ├─ 输入 username + password + confirmPassword
  ├─ 前端校验：密码长度 ≥ 6，两次输入一致
  ├─ POST /api/users/register
  │   ├─ 成功 → 存储 token → redirectTo: pages/index/index
  │   └─ 失败 → 提示错误信息
  │
  └─ 点击「返回登录」→ navigateBack
```

---

## 4. 新增文件

### 4.1 `pages/login/login.vue` — 登录页

- 顶部橙色渐变区域：App Logo + 名称 + "欢迎使用"
- 白色卡片表单区：用户名输入框、密码输入框
- 渐变橙色圆角登录按钮
- 底部"还没有账号？立即注册"链接
- UI 风格完全参照 `pages/index/index.vue` 的 `mask-content`、`summary-board`、`add-btn` 等元素

### 4.2 `pages/login/register.vue` — 注册页

- 顶部橙色渐变区域：标题"创建账号"
- 白色卡片表单区：用户名、密码、确认密码
- 渐变橙色圆角注册按钮
- 底部"已有账号？返回登录"链接
- 前端校验：密码 ≥ 6 位、两次密码一致

### 4.3 `common/api.js` — API 请求封装

- 封装 `uni.request`，统一 baseURL
- 请求拦截器：自动从 Storage 读取 token 注入 `Authorization: Bearer <token>` 头
- 响应拦截器：统一处理 `code !== 0` 的情况，401 时清除 token 并跳转登录页
- 导出 `api.get(url, data)`, `api.post(url, data)` 等方法

### 4.4 `common/config.js` — 配置常量

- `API_BASE_URL`：后端接口地址（开发环境默认 `http://localhost:3000`）
- `TOKEN_KEY`：存储 token 的 key 名称

---

## 5. 修改文件

### 5.1 `pages.json`

- `pages` 数组首位新增 `pages/login/login`
- 新增 `pages/login/register`
- 登录/注册页面不需要自定义导航栏（使用默认或保持 `navigationStyle: custom`）

### 5.2 `App.vue`

- 在 `onLaunch` 中添加 token 校验逻辑：
  - 读取 Storage 中的 token
  - 若有 token，调用 `/api/users/profile` 验证有效性
  - 若 token 无效或不存在，跳转登录页
  - 注意处理当前已在登录页的情况避免死循环

---

## 6. UI 规范

与现有项目保持完全一致：

| 元素 | 规范 |
|------|------|
| 页面背景 | `#F6F7FB` |
| 顶部渐变 | `radial-gradient(circle at top right, #FF8C00, #E67E00)` |
| 顶部圆角 | `border-radius: 0 0 60rpx 60rpx` |
| 卡片 | 白色 `#FFFFFF`, `border-radius: 32rpx`, `box-shadow: 0 8rpx 30rpx rgba(0,0,0,0.04)` |
| 输入框 | 背景 `#F6F7FB`, `border-radius: 20rpx`, focus 时 `border-color: rgba(#FF8C00, 0.4)` + `box-shadow: 0 0 0 6rpx rgba(#FF8C00, 0.08)` |
| 主按钮 | `linear-gradient(135deg, #FF8C00, #E67E00)`, `border-radius: 55rpx`, `height: 110rpx`, `box-shadow: 0 15rpx 30rpx rgba(#FF8C00, 0.4)` |
| 主标题 | `font-size: 48rpx`, `font-weight: 700`, `color: #FFFFFF` |
| 正文 | `font-size: 30-32rpx`, `color: #2D3139` / `#333` |
| 辅助文字 | `font-size: 22-24rpx`, `color: #999` |
| 链接文字 | `font-size: 28rpx`, `color: #FF8C00` |

---

## 7. 数据存储

使用 `uni.setStorageSync` / `uni.getStorageSync`：

| Key | 值 | 说明 |
|-----|-----|------|
| `AUTH_TOKEN` | JWT 字符串 | 登录后存储，退出时清除 |
| `USER_INFO` | `{ id, username }` | 当前登录用户基本信息 |

---

## 8. 错误处理

| 场景 | 处理 |
|------|------|
| 网络错误 | `uni.showToast({ title: '网络连接失败', icon: 'none' })` |
| 账号密码错误 | 显示后端返回的 message（如"账号或密码错误"） |
| 账号已存在（注册） | 显示后端返回的 message |
| Token 过期 (401) | 清除本地 token，跳转登录页，提示"登录已过期，请重新登录" |
| 密码不足 6 位（注册） | 前端先校验，提示"密码长度不能少于6位" |
| 两次密码不一致（注册） | 前端校验，提示"两次密码输入不一致" |

---

## 9. 不包含的内容

- 不修改后端 API 代码
- 不修改现有设备管理页面逻辑
- 不实现"记住密码"、"忘记密码"功能
- 不实现第三方登录（微信/手机号等）
- 不实现设备绑定功能的前端对接（后续迭代）
