# CKZS 项目 Bug 清单

## P0 核心流程

- [ ] **BUG-03 登录首页“添加新设备”没有绑定到当前账号**
  - 状态：待确认业务规则
  - 范围：App、API
  - 影响：蓝牙连接成功后只写入本地 `SAVED_BLUETOOTH_DEVICES`，不会进入账号的“我的设备”。
  - 位置：`CKZS/pages/home/index.vue`、`CKZS/pages/index/bluetooth.vue`、`CKZS_API/src/controllers/user.controller.js`
  - 验收：先确认“添加新设备”是否应该同时绑定账号；如需要，绑定成功后列表和后端归属同步更新。

## P1 数据与状态


- [ ] **BUG-07 首页全量在线/离线统计可能使用历史状态**
  - 状态：待确认产品口径
  - 范围：App、API、MQTT
  - 影响：首页只实时探测当前页，其余设备依赖数据库中上次保存的 `online` 状态。
  - 位置：`CKZS/pages/home/index.vue`、`CKZS_API/src/controllers/user.controller.js`
  - 验收：明确“实时状态”或“最近状态”的口径；统计结果与该口径一致。

- [ ] **BUG-09 MQTT 透传回包可能匹配到错误命令**
  - 状态：待真机验证
  - 范围：API、MQTT、硬件协议
  - 影响：设备下一条 data 上报会直接作为当前命令回执；主动上报、并发命令和分包数据可能导致串包或误判成功。
  - 位置：`CKZS_API/src/services/mqtt.service.js`
  - 验收：记录真实 Topic 和回包时序，确认命令响应可以被唯一匹配且完整组帧。


## 管理端与运维

- [ ] **BUG-12 `/health` 无法发现数据库或 MQTT 故障**
  - 状态：待确认部署需求
  - 范围：API、部署
  - 影响：健康检查固定返回 `ok`，数据库或 MQTT 已不可用时仍可能被判定为健康。
  - 位置：`CKZS_API/src/app.js`
  - 验收：健康结果能区分 HTTP 存活、数据库状态和 MQTT 状态。


## 待真实设备验证

- [ ] **BUG-15 蓝牙设备“异常”状态可能误判**
  - 状态：待确认业务定义
  - 范围：App
  - 影响：仅根据名称以 `HF-SPP` 或 `JDY` 开头就显示异常，没有读取真实故障状态。
  - 位置：`CKZS/pages/index/index.vue`、`CKZS/pages/index/bluetooth.vue`、`CKZS/pages/home/index.vue`
  - 验收：确认型号前缀的业务含义；异常应由明确状态或故障字段决定。

