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
OTA_ACK_TIMEOUT_MS=5000
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
  "firmwareFile": "lobster-feeder.pkg"
}
```

后台会校验设备已绑定、在线且属于当前用户；管理员可以操作其他用户的设备。
成功返回 HTTP `202`，其中 `data.id` 是任务 ID。

## 管理端 OTA 批次

以下接口仅管理员可用，均使用 Bearer Token。OTA 固件统一使用 `.pkg` 文件；管理端只列出服务器固件目录中的 `.pkg` 文件。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/ota/firmwares` | 列出服务器固件及版本、大小、SHA-256 |
| POST | `/api/ota/firmwares` | 上传一个新版本（原始二进制请求体，最大 10 MB；旧版本保留） |
| POST | `/api/ota/preview` | 预览全部设备、指定用户设备或单个设备范围 |
| POST | `/api/ota/batches` | 创建并开始一个串行升级批次 |
| GET | `/api/ota/batches` | 分页查看批次，可按状态筛选 |
| GET | `/api/ota/batches/{batchId}` | 查看批次和逐设备进度/结果 |
| POST | `/api/ota/batches/{batchId}/pause` | 当前设备任务结束后暂停该批次后续设备 |
| POST | `/api/ota/batches/{batchId}/resume` | 恢复批次中等待处理的设备 |
| POST | `/api/ota/batches/{batchId}/retry-failed` | 将仍在线的失败设备重新排队 |

上传固件使用 `Content-Type: application/octet-stream`，请求体为 `.pkg` 文件原始内容。服务端按固件版本和 SHA-256 生成新的固件文件名，以临时文件写入后原子创建；相同内容不会重复保存，旧版本不会被覆盖或删除。上传后固件列表会包含服务器目录中的所有 `.pkg`，管理员可在下拉框选择旧版本发起升级。预览和创建批次使用相同请求字段，`firmwareFile` 填固件列表接口返回的文件名。全部设备：`{"scope":"all","firmwareFile":"lobster-feeder-20261007-V2-a01d6c38a939.pkg"}`；指定账号：增加 `targetUserId`，可用 `deviceCodes` 限定该账号的部分设备；账号列表包含 APP 用户和管理员；单设备：使用 `scope: "device"` 和 `deviceCode`。所有设备范围均只包含已绑定设备；创建时离线或已在处理其他任务的设备会被记录为跳过。批次与逐设备任务保存在数据库中，服务重启后已开始的任务会标记失败，未开始的批次保留为暂停状态，可由管理员恢复。

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

- 设备任务按服务进程内全局串行队列执行；服务重启后已开始的任务会标记失败，尚未开始的批次会暂停，需管理员手动恢复。
- `success` 表示设备返回 `OTA:READY` 且服务端发出了 `$G`，不代表设备重启后已验证新固件运行正常。
- OTA 期间同一设备的普通命令、批量命令和状态查询会被拒绝，防止普通回包干扰 OTA ACK。
