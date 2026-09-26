# MQTT OTA API

OTA 复用现有 MQTT Topic：

- 下行：`test/down/{deviceCode}`
- 上行：`test/up/{deviceCode}`

固件文件只允许从服务器 `OTA_FIRMWARE_DIR` 目录读取，默认目录为
`/opt/ota/firmware`。客户端只传文件名，不传绝对路径。

可选环境变量：

```text
OTA_FIRMWARE_DIR=/opt/ota/firmware
OTA_CHUNK_SIZE=1024
OTA_ACK_TIMEOUT_MS=2000
OTA_BEGIN_TIMEOUT_MS=8000
OTA_MODE_SETTLE_MS=500
OTA_BEGIN_MAX_ATTEMPTS=2
OTA_END_TIMEOUT_MS=15000
OTA_MAX_RETRY=3
```

`OTA_CHUNK_SIZE` 的有效范围为 `64-2048`；超过 `2048` 会自动限制为
`2048`，以匹配 MCU 的单帧 payload 上限。

收到 `$F` 的 `Ok` 后，服务端默认等待 `500ms` 再发送 BEGIN。BEGIN 超时或设备返回
`OTA:RETRY:0` 时，服务端最多发送 2 次相同的 BEGIN 帧；日志会记录 BEGIN 十六进制内容
及设备的 ACK/RETRY 响应，便于区分发布和设备解析问题。

排查单设备 OTA 时，PM2 日志中的 `[OTA下行Broker确认]` 表示 MQTT Broker 已确认服务端
发布；它不能单独证明 MCU 已收到。`[OTA原始上行]` 会记录 OTA 活跃期间设备发到
`test/up/{deviceCode}` 的 MQTT 原始数据（最多记录前 512 字节），包含十六进制及转义文本。
如果 DTU 没有把 MCU 串口数据转发到该上行 Topic，服务端日志也无法看到串口内容。

## 创建升级任务

`POST /api/ota/start`

请求需要已有的 Bearer Token。

```json
{
  "deviceCode": "设备IMEI",
  "firmwareFile": "lobster-feeder.bin"
}
```

后台会校验设备已绑定、在线且属于当前用户；管理员可以操作其他用户的设备。
成功返回 HTTP `202`，其中 `data.id` 是任务 ID。

## 查询升级任务

`GET /api/ota/tasks/{taskId}`

任务状态：

- `pending`：等待启动
- `starting`：正在读取固件并进入 OTA 模式
- `transferring`：正在分包传输
- `verifying`：设备正在校验固件
- `rebooting`：已发送重启指令
- `success`：协议传输完成并已发送重启指令
- `failed`：升级失败，`message` 包含原因

`success` 只表示设备返回 `OTA:READY` 且服务器已发送 `$G`。当前版本尚未在设备
重连后再次查询固件版本，因此不能把它解释为已经验证新固件正常运行。

## 当前边界

- 任务保存在 Node 进程内存中，服务重启后任务记录会丢失。
- 当前只提供单设备升级接口；批量升级应在单设备实机验证通过后增加队列和并发限制。
- OTA 期间同一设备的普通命令、批量命令和状态查询会被拒绝，防止普通回包干扰 OTA ACK。
