# CKZS PC 管理端

该目录为基于 Vue 3、Vue Router 和 Vite 的 CKZS 硬件设备 PC 管理系统，生产构建结果由 `CKZS_API` 直接托管。

## 启动

1. 安装并构建管理端：

   ```bash
   cd CKZS_ADMIN
   npm install
   npm run build
   ```

2. 根据 `CKZS_API/.env.example` 准备后端环境配置。
3. 在 `CKZS_API` 目录启动服务：

   ```bash
   npm start
   ```

4. 浏览器访问：

   ```text
   http://localhost:<PORT>/admin/
   ```

管理端只允许 `role` 为 `admin` 的账号进入。登录、设备列表、用户列表、统计数据和设备操作均来自现有 Express 服务的真实接口。

本地页面开发可在 `CKZS_ADMIN` 执行 `npm run dev`，Vite 会将 `/api` 请求代理到 APP 当前使用的线上接口 `http://47.236.100.138`。

## 功能

- 管理员登录与 JWT 会话校验
- 全平台用户、设备、在线状态和绑定状态数据总览
- 设备分页查询、登记、编辑、分配和解绑
- 用户分页查询、用户设备查看和密码重置
- 单设备指令下发和多设备批量指令下发

> 指令控制会通过后端 MQTT 服务操作真实硬件，执行前请核对目标设备和指令内容。

PC 管理功能使用同一个 `CKZS_API` 下的 `/api/admin/*` 接口。新增接口部署到 APP 当前使用的后端服务后，PC 与 APP 会共享同一套用户、设备和绑定数据。
