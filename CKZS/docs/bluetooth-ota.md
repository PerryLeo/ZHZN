# App 蓝牙 OTA

入口：蓝牙设备详情 → 手动设置 → 设备版本上方的「OTA升级」。使用现有橙色主题、圆角弹窗和卡片列表；游客与登录用户都可使用。

## 流程

1. 调用公开接口 `GET /api/ota/bluetooth/firmwares`，展示版本、文件名、大小和日期。
2. 用户选择固件，确认设备适配及供电状态。
3. 通过 `uni.downloadFile` 下载到手机临时文件；校验大小（上限 10 MB）和 SHA-256。
4. 暂停普通设置指令和页面蓝牙读流，OTA 独占当前 Android SPP/RFCOMM Socket；保持屏幕常亮。
5. 发送 `$F\n`，收到 `Ok` 后等待 500 ms，再发送 BEGIN、DATA、END。
6. 等待 `OTA:READY`，发送 `$G\n`，展示「固件传输完成」；新固件是否运行成功须重新连接并读取设备版本确认。
7. 结束后释放 OTA 读流、恢复页面监听、清理下载的临时文件并恢复屏幕常亮设置。

整个过程无需 IMEI、用户绑定或 `/api/ota/start`，设备不需要 4G；固件列表和下载需要手机联网。使用前需部署此前新增的服务端公开固件接口。

## 协议及当前假设

按硬件支持及双方协议相同的约定，实现与 `CKZS_API/src/services/ota.service.js` 相同的格式：

- 帧：`AA 55 + type(1) + offset(4, LE) + length(2, LE) + payload + CRC16(2, LE)`。
- CRC16-CCITT：初始值 `0xFFFF`、多项式 `0x1021`；帧 CRC 覆盖 type 至 payload。
- BEGIN（type=1）：payload 为固件长度（4, LE）及固件 CRC（2, LE），应答 `OTA:ACK:0`。
- DATA（type=2）：每包最多 1024 字节，成功应答 `OTA:ACK:<下一偏移>`；`OTA:RETRY:<偏移>` 要求重传。
- END（type=3）：offset 为固件总长度，等待 `OTA:READY`。
- 进入模式超时 5 秒、BEGIN 超时 8 秒（最多两次）、DATA 超时 5 秒、END 超时 15 秒；连续三次无进展失败，另设总重试次数上限。
- `OTA:ERR:` 立即终止；断连或离开前台时中断，提示重新连接确认设备状态。升级期间拦截返回操作。
- 应答按字节流累积解析，支持分段和连续多行；未带换行的应答在读流静默 100 ms 后匹配，硬件应优先返回完整换行应答。

必须通过实机确认：进入 Bootloader 后 SPP 是否保持连接、同一串口是否接受 OTA 原始二进制、实际允许包长、重传语义及 `$G` 切换行为。当前未实现跨连接断点续传或自动重连。

## 验证

开发时已通过 Vue SFC 脚本及模板编译、标准 CRC 向量、与服务端帧格式比对、二进制 Base64 往返、模拟下载文件校验、模拟设备应答拆包、超时及重传、错误应答及断连检查。模拟 Native.js 对象不能证明 Android 原生桥接和设备固件实际行为。

实机联调步骤：

1. HBuilderX 运行至 Android 真机，在游客模式连接设备，进入手动设置，确认 OTA 行的位置、弹窗列表及未选固件时按钮禁用。
2. 选用硬件确认匹配的固件，查看下载、SHA-256 校验、逐包传输及设备校验进度；采集 `[蓝牙OTA]` 日志及设备串口日志。
3. 收到 READY 并发送重启后，重新连接并读取 `Ver:`，核对所选固件版本。
4. 在可恢复的测试设备上检查断连、进入后台和超时情况，确认失败提示、临时文件清理及读流释放。

API 使用参照 [uni.downloadFile](https://uniapp.dcloud.net.cn/api/request/network-file.html)、[HTML5+ FileReader](https://www.html5plus.org/doc/zh_cn/io.html) 和 [Native.js Android](https://www.html5plus.org/doc/zh_cn/android.html) 官方文档。
