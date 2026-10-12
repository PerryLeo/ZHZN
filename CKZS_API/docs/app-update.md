# Android App 版本发布与更新

管理端菜单「App版本管理」支持上传 APK（最大 200 MB）、选择普通/强制更新、保存草稿、发布和撤回。APK 流式写入独立目录，SHA-256 自动计算；包名、版本名称、整数 versionCode 和最低 Android SDK 从 APK 清单读取。

## APK 校验与发布

服务端无需新增 npm 依赖或 Android SDK 工具。按 [AOSP APK v2 签名规范](https://source.android.com/docs/security/features/apksigning/v2) 校验证书、公钥、签名和 APK 完整内容摘要，支持 RSA、RSA-PSS、ECDSA、DSA 的标准 SHA-256/SHA-512 算法。要求 APK 含 v2 签名，可同时含 v1/v3；仅 v1 或仅 v3 的包会明确拒绝。首次上传确立包名及签名证书，管理员需确认上传的是本 App 的正式安装包；后续上传必须匹配。

每个 versionCode 只能上传一次，同一时间仅一个版本发布，新发布版本会将前一版本归档。撤回停止公开检查及新的下载，但不能撤销已经完成的下载或回退已安装的 App。历史发布过的较低版本不能重新发布；出现问题应使用更大的 versionCode 发布修复包。撤回的同一版本可再次发布，前提是没有更高版本曾发布。

## 部署

- 默认 APK 目录 `/opt/ckzs/app-releases`，可通过可选环境变量 `APP_RELEASE_DIR` 指定。本次未修改现有环境变量或部署配置。
- 服务进程需对目录有读写权限；APK 不放在静态公开目录，下载经过发布状态检查。旧 APK 保留。
- API 启动时现有 `syncDB()` 会创建 `app_releases` 表，不修改已有表数据；数据库账号需有建表权限。
- 若服务器前有 Nginx/网关，应确认请求体大小允许 200 MB，上传超时允许大文件上传。管理端请求超时 10 分钟。服务端有 200 MB 上限，超过上限会拒绝上传。
- 使用现有单进程 API 模式，上传及发布变更由进程内互斥协调，发布状态切换使用数据库事务。多进程/多实例需要再补充跨进程锁。
- 部署 API 及重新构建的 `CKZS_ADMIN/dist` 后，首次上传、发布本 App 的 APK。
- App 新增 `android.permission.REQUEST_INSTALL_PACKAGES`，需重新打完整 APK，不能只发布 wgt。未变更证书、包名、版本字段；打包时递增 `manifest.json` 的 versionCode，并使用现有正式签名。
- 首个带检查功能的版本须先人工安装到手机；没有更新功能的旧 App 不会因为后台发布而自动获得此能力。

## 接口

| 方法 | 路径 | 权限与用途 |
| --- | --- | --- |
| GET | `/api/app/check?packageName=...&versionCode=100&sdkVersion=33` | 公开；检查已发布更新 |
| GET | `/api/app/releases/{id}` | 公开；仅已发布版本的元数据 |
| GET | `/api/app/releases/{id}/download` | 公开；下载已发布 APK，支持 HTTP Range |
| GET | `/api/app/releases?page=1` | 管理员；版本分页记录 |
| POST | `/api/app/releases` | 管理员；`application/octet-stream` 原始 APK 请求体 |
| PUT | `/api/app/releases/{id}` | 管理员；编辑待发布/已撤回版本 |
| POST | `/api/app/releases/{id}/publish` | 管理员；发布 |
| POST | `/api/app/releases/{id}/withdraw` | 管理员；撤回 |

检查响应沿用 `{code:0,message:"ok",data:{hasUpdate,release}}`。未发布、当前版本已最新或手机 SDK 低于 APK 最低要求时 `hasUpdate:false,release:null`。有更新时 release 含 `id/packageName/versionName/versionCode/minSdkVersion/fileSize/sha256/forceUpdate/publishedAt/downloadUrl`；下载地址为相对 API 服务域名的路径。

编辑请求示例：

```json
{"forceUpdate":false}
```

## App 行为

- 保持原启动页为首页；启动时在登录检查前匿名检查一次更新，检查超时 3 秒、网络失败或无更新时继续原流程。
- 回到前台时最多每 6 小时自动检查一次；更新弹窗已显示或蓝牙 OTA 进行中时跳过，避免重复弹出或干扰设备升级。
- 蓝牙/网络设备的手动设置「APP版本」显示实际安装包版本，点击可立即手动检查更新。
- 在当前页面显示橙色主题更新弹窗，展示版本和安装包大小，不填写或显示更新内容；普通更新可稍后使用，强制更新需更新或退出 App。发现更新后重新读取发布状态失败时提示重试；启动检查网络失败仍允许进入 App。
- 下载到手机本地，分段读取校验 SHA-256、文件大小及 APK 包名/版本，避免将完整大 APK 转成 JS Base64 字符串。
- Android 8+ 未授权安装来源时打开系统授权页面，用户允许后返回点击「重新安装」。APK 安装由系统确认，不能静默安装。
- 安装界面调起仅表示开始安装，不能视为覆盖安装成功；取消安装可重试。缓存已校验的包，重试安装前再次校验；下次启动读取实际 versionCode 后清理旧缓存。
- 当前实现 Android APK 更新；iOS/H5 不执行 APK 检查。没有跨连接断点续传，网络失败后重新下载。

## 验证与边界

开发验证：管理端生产构建、App Vue SFC 编译、使用 AOSP 官方 APK 样本验证 v2/v1+v2+v3/多签名包，并拒绝破损签名与篡改内容；HTTP 路由使用模拟数据库检查管理权限、上传、编辑、发布、游客检查及下载、重复版本、撤回和临时文件清理。

仍需：真实 MySQL 建表与事务验证，部署后检查大文件代理限制，使用两个相同正式签名且 versionCode 递增的 APK 在 Android 真机上验证普通/强制更新、安装权限、取消安装、断网重试、覆盖后的登录和蓝牙设备记录保留。HBuilderX 调试基座的包名和运行时版本可能与正式 APK 不同，应以正式安装包验证更新。

运行时接口参照 [HTML5+ runtime](https://www.html5plus.org/doc/zh_cn/runtime.html) 和 [Native.js Android](https://www.html5plus.org/doc/zh_cn/android.html)。
