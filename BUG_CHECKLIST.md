# CKZS 项目 Bug 清单

本清单覆盖移动端 `CKZS`、后端 `CKZS_API` 和管理端 `CKZS_ADMIN`。

## 使用规则

- `[ ]` 表示尚未关闭，`[x]` 表示已经关闭。
- 每项的状态可填写：`待确认`、`待修复`、`待验证`、`已修复`、`不处理`。
- 修复和明确决定不处理都可以关闭复选框，但必须保留处理结论。
- 一次只处理一个编号，避免不同问题相互影响。
- 涉及 MySQL、MQTT、蓝牙或真实硬件的项目，静态检查通过后仍需保留真机验证结果。

## P0 核心流程

- [ ] **BUG-01 启动页调用了未注册的用户资料接口**
  - 状态：待确认
  - 范围：App、API
  - 影响：`GET /api/users/profile` 返回 404，有效 Token 会被清除，用户被迫重新登录。
  - 位置：`CKZS/pages/launch/index.vue`、`CKZS/pages/mine/index.vue`、`CKZS_API/src/routes/user.routes.js`
  - 验收：有效 Token 冷启动可直接进入首页，“我的”页可刷新当前用户资料。

- [ ] **BUG-02 退出登录后可能被自动重新登录**
  - 状态：待确认
  - 范围：App
  - 影响：退出时未清除保存的账号密码，下次冷启动会重新执行自动登录；修改密码后仍会预填旧密码。
  - 位置：`CKZS/pages/mine/index.vue`、`CKZS/pages/mine/changePassword.vue`、`CKZS/pages/launch/index.vue`
  - 验收：退出后冷启动保持未登录；修改密码后不再使用旧密码自动登录。

- [ ] **BUG-03 登录首页“添加新设备”没有绑定到当前账号**
  - 状态：待确认业务规则
  - 范围：App、API
  - 影响：蓝牙连接成功后只写入本地 `SAVED_BLUETOOTH_DEVICES`，不会进入账号的“我的设备”。
  - 位置：`CKZS/pages/home/index.vue`、`CKZS/pages/index/bluetooth.vue`、`CKZS_API/src/controllers/user.controller.js`
  - 验收：先确认“添加新设备”是否应该同时绑定账号；如需要，绑定成功后列表和后端归属同步更新。

- [ ] **BUG-04 首页单设备和批量开关不可用**
  - 状态：等待硬件协议确认
  - 范围：App、API、硬件协议
  - 影响：单设备开关指令为空；“全部开启”和“全部关闭”按钮为空实现。
  - 位置：`CKZS/pages/home/index.vue`
  - 验收：确认开关协议后，单设备及批量操作均有确认、结果反馈和失败处理。

## P1 数据与状态

- [ ] **BUG-05 首页设备电量始终显示 `--`**
  - 状态：待确认协议字段
  - 范围：App、硬件协议
  - 影响：状态解析把 `battery` 固定为 `null`，不会读取真实电量。
  - 位置：`CKZS/pages/home/index.vue`
  - 验收：确认设备回包中的电量字段，并验证有效数值和数值 `0` 都能正确显示。

- [ ] **BUG-06 设备绑定成功后被直接标记为在线**
  - 状态：待确认
  - 范围：API、App、管理端
  - 影响：绑定操作未验证 MQTT 或设备应答就写入 `online = 1`，可能显示假在线。
  - 位置：`CKZS_API/src/controllers/user.controller.js`
  - 验收：绑定只改变归属；在线状态由心跳、MQTT 上下线事件或实时探测决定。

- [ ] **BUG-07 首页全量在线/离线统计可能使用历史状态**
  - 状态：待确认产品口径
  - 范围：App、API、MQTT
  - 影响：首页只实时探测当前页，其余设备依赖数据库中上次保存的 `online` 状态。
  - 位置：`CKZS/pages/home/index.vue`、`CKZS_API/src/controllers/user.controller.js`
  - 验收：明确“实时状态”或“最近状态”的口径；统计结果与该口径一致。

- [ ] **BUG-08 两个用户并发绑定同一设备可能覆盖归属**
  - 状态：待修复
  - 范围：API、数据库
  - 影响：用户绑定接口缺少事务和行锁，并发请求可能都收到成功但最终归属被覆盖。
  - 位置：`CKZS_API/src/controllers/user.controller.js`
  - 验收：并发绑定时仅一个用户成功，另一个收到明确的已绑定提示。

- [ ] **BUG-09 MQTT 透传回包可能匹配到错误命令**
  - 状态：待真机验证
  - 范围：API、MQTT、硬件协议
  - 影响：设备下一条 data 上报会直接作为当前命令回执；主动上报、并发命令和分包数据可能导致串包或误判成功。
  - 位置：`CKZS_API/src/services/mqtt.service.js`
  - 验收：记录真实 Topic 和回包时序，确认命令响应可以被唯一匹配且完整组帧。

- [ ] **BUG-10 首页刷新失败仍提示“重置成功”**
  - 状态：待修复
  - 范围：App
  - 影响：列表、统计或分组接口失败后，外层仍无条件提示成功。
  - 位置：`CKZS/pages/home/index.vue`
  - 验收：全部成功时提示成功；部分或全部失败时显示对应错误，不能误报成功。

## 管理端与运维

- [ ] **BUG-11 管理端设备详情可能展示缓存旧数据**
  - 状态：待确认
  - 范围：管理端
  - 影响：只要 `sessionStorage` 中存在设备数据，详情页就不会重新获取服务端最新归属和基础信息。
  - 位置：`CKZS_ADMIN/src/views/DeviceDetailView.vue`
  - 验收：缓存仅用于首屏占位，随后以服务端最新数据覆盖。

- [ ] **BUG-12 `/health` 无法发现数据库或 MQTT 故障**
  - 状态：待确认部署需求
  - 范围：API、部署
  - 影响：健康检查固定返回 `ok`，数据库或 MQTT 已不可用时仍可能被判定为健康。
  - 位置：`CKZS_API/src/app.js`
  - 验收：健康结果能区分 HTTP 存活、数据库状态和 MQTT 状态。

- [ ] **BUG-13 管理端按分组筛选时需要拉取全部设备**
  - 状态：待确认数据规模
  - 范围：管理端、API
  - 影响：设备量增加后会产生大量连续请求，页面加载时间明显变长。
  - 位置：`CKZS_ADMIN/src/views/DevicesView.vue`
  - 验收：后端支持 `groupId` 分页筛选，前端只请求当前页。

## 待真实设备验证

- [ ] **BUG-14 网络闹钟的批量同步 ACK 机制可能与硬件不一致**
  - 状态：待真机验证
  - 范围：App、API、MQTT、硬件协议
  - 影响：网络版每发送一条配置都等待一次回包；若硬件只在全部配置完成后回复一次，第一条就会超时。
  - 位置：`CKZS/pages/networkDeviceState/alarmClock.vue`
  - 验收：使用真实设备验证 12 条配置的发送顺序、ACK 数量、超时和失败重试。

- [ ] **BUG-15 蓝牙设备“异常”状态可能误判**
  - 状态：待确认业务定义
  - 范围：App
  - 影响：仅根据名称以 `HF-SPP` 或 `JDY` 开头就显示异常，没有读取真实故障状态。
  - 位置：`CKZS/pages/index/index.vue`、`CKZS/pages/index/bluetooth.vue`、`CKZS/pages/home/index.vue`
  - 验收：确认型号前缀的业务含义；异常应由明确状态或故障字段决定。

## 安全类问题

- [ ] **BUG-16 App 明文保存并输出账号密码和 Token**
  - 状态：待确认是否纳入本轮
  - 范围：App
  - 影响：本地存储保存密码，请求调试日志完整输出登录 Body 和 Authorization Token。
  - 位置：`CKZS/common/config.js`、`CKZS/common/request.js`、登录及注册页
  - 验收：本地不持久化密码；调试日志默认关闭或对敏感字段脱敏。

- [ ] **BUG-17 管理员密码重置使用固定密码且旧 Token 仍有效**
  - 状态：待确认是否纳入本轮
  - 范围：App、管理端、API
  - 影响：重置密码固定为 `123456`，其他终端已经签发的 Token 不会失效。
  - 位置：`CKZS_API/src/controllers/user.controller.js`、`CKZS/pages/mine/index.vue`、`CKZS_ADMIN/src/views/UsersView.vue`
  - 验收：采用不可预测的重置方式，并明确密码重置后的会话失效规则。

## 处理记录

| 编号 | 处理结论 | 验证结果 | 日期 |
| --- | --- | --- | --- |
| - | - | - | - |
