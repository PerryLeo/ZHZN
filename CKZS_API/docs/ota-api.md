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

## App 蓝牙 OTA 固件获取（无需鉴权）

以下两个 GET 接口不需要登录、Bearer Token、IMEI 或设备绑定信息。服务器仅提供固件，手机负责下载校验并通过蓝牙传输；不会创建 MQTT OTA 任务。

### 固件列表

`GET /api/ota/bluetooth/firmwares`

列出服务器固件目录中的所有 `.pkg` 文件，按修改时间倒序排列。目录不存在或没有固件时返回空数组。

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "firmwareFile": "lobster-feeder.pkg",
      "firmwareVersion": "20261012-V2",
      "firmwareSize": 102400,
      "firmwareSha256": "固件原始文件的64位SHA-256十六进制值",
      "updatedAt": "2026-10-12T00:00:00.000Z",
      "downloadUrl": "/api/ota/bluetooth/firmwares/lobster-feeder.pkg/download"
    }
  ]
}
```

`downloadUrl` 是相对于 API 服务域名的地址；App 应使用配置的服务器地址拼接。`firmwareVersion` 从文件内容解析，无法识别时为空字符串。目前没有设备型号筛选，App 需确认所选固件适用于当前设备。

### 下载固件

`GET /api/ota/bluetooth/firmwares/{firmwareFile}/download`

`firmwareFile` 使用列表返回的文件名，并进行 URL 编码。成功返回 HTTP `200` 和固件原始二进制内容（不是 JSON），响应包含：

- `Content-Type: application/octet-stream`
- `Content-Disposition: attachment; ...`
- `X-Firmware-SHA256`：本次下载内容的 SHA-256

App 下载后应对照列表中的 `firmwareSize` 和 `firmwareSha256` 校验文件，再进行蓝牙升级。非法文件名或目录外的符号链接返回 `400`；文件不存在或为空返回 `404`；读取失败返回 `500`。错误响应沿用统一 JSON 格式。

现有管理端固件列表、上传、批次操作及 MQTT 单设备升级接口仍按下文要求鉴权。

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
| DELETE | `/api/ota/firmwares/{firmwareFile}` | 删除指定固件文件，保留历史任务记录 |
| POST | `/api/ota/preview` | 预览全部设备、指定用户设备或单个设备范围 |
| POST | `/api/ota/batches` | 创建并开始一个串行升级批次 |
| GET | `/api/ota/batches` | 分页查看批次，可按状态筛选 |
| GET | `/api/ota/batches/{batchId}` | 查看批次和逐设备进度/结果 |
| POST | `/api/ota/batches/{batchId}/pause` | 当前设备任务结束后暂停该批次后续设备 |
| POST | `/api/ota/batches/{batchId}/resume` | 恢复批次中等待处理的设备 |
| POST | `/api/ota/batches/{batchId}/retry-failed` | 将仍在线的失败设备重新排队 |

上传固件使用 `Content-Type: application/octet-stream`，请求体为 `.pkg` 文件原始内容。服务端按固件版本和 SHA-256 生成新的固件文件名，以临时文件写入后原子创建；相同内容不会重复保存，旧版本不会被覆盖或删除。上传后固件列表会包含服务器目录中的所有 `.pkg`，管理员可在下拉框选择旧版本发起升级。预览和创建批次使用相同请求字段，`firmwareFile` 填固件列表接口返回的文件名。全部设备：`{"scope":"all","firmwareFile":"lobster-feeder-20261007-V2-a01d6c38a939.pkg"}`；指定账号：增加 `targetUserId`，可用 `deviceCodes` 限定该账号的部分设备；账号列表包含 APP 用户和管理员；单设备：使用 `scope: "device"` 和 `deviceCode`。所有设备范围均只包含已绑定设备；创建时离线或已在处理其他任务的设备会被记录为跳过。批次与逐设备任务保存在数据库中，服务重启后已开始的任务会标记失败，未开始的批次保留为暂停状态，可由管理员恢复。

### 删除固件

仅管理员可调用 `DELETE /api/ota/firmwares/{firmwareFile}`，需要 Bearer Token。文件名使用固件列表返回值，并进行 URL 编码；只能删除固件目录中的普通 `.pkg` 文件，不允许目录、路径穿越或符号链接。

成功返回 HTTP `200`，`data` 为 `{"firmwareFile":"已删除的文件名.pkg"}`。非法文件名或非普通文件返回 `400`，文件不存在返回 `404`；该固件存在 `pending`、`starting`、`transferring`、`verifying`、`rebooting` 任务时返回 `409`，暂停批次中的等待任务同样禁止删除。上传、删除以及任务创建、恢复或重试并发冲突时返回 `409`，稍后重试。

删除会移除服务器文件，管理端和蓝牙固件列表均不再提供该文件，但不会删除数据库中的历史升级记录，也不会更改设备已安装的固件。删除后的历史失败任务不能直接重试，需重新上传对应固件或选择其他固件创建新任务。蓝牙升级由手机执行，服务端无法识别手机是否正在升级；手机已下载的固件不会被本接口撤回。

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
