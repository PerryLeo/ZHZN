// MQTT Topic 规范 & 默认配置
// 所有 4G 模块通过固定 Topic 与后端交互

export const MQTT_TOPIC = {
  /** 设备 → 后端：定时上报数据 */
  DATA_UP: (deviceCode) => `test/up/${deviceCode}`,

  /** 后端 → 设备：下发指令 */
  COMMAND_DOWN: (deviceCode) => `test/down/${deviceCode}`,

  /** 设备 → 后端：指令执行结果回执 */
  COMMAND_ACK: (deviceCode) => `device/${deviceCode}/command/ack`,

  /** 设备 → 后端：上线通知（可选，Will Message 也能用）*/
  ONLINE: (deviceCode) => `device/${deviceCode}/online`,

  /** 设备 → 后端：离线通知（由 EMQX Will Message 触发）*/
  OFFLINE: (deviceCode) => `device/${deviceCode}/offline`,

  /** 后端监听：所有设备数据上报（单级通配订阅，+ 匹配一个层级即 IMEI）*/
  ALL_DATA: 'test/up/+',

  /** 后端监听：所有设备上线 */
  ALL_ONLINE: 'device/+/online',

  /** 后端监听：所有设备离线 */
  ALL_OFFLINE: 'device/+/offline',

  /** 后端监听：所有设备指令回执 */
  ALL_ACK: 'device/+/command/ack',
};

/**
 * 从 topic 中提取 deviceCode（IMEI）
 *   test/up/869123001     → 869123001
 *   test/down/869123001   → 869123001
 *   device/869123001/...  → 869123001
 */
export const parseDeviceCode = (topic) => {
  const parts = topic.split('/');
  // test/up/IMEI 或 test/down/IMEI
  if (parts[0] === 'test' && parts.length >= 3) return parts[2];
  // device/IMEI/...
  if (parts[0] === 'device' && parts.length >= 2) return parts[1];
  return null;
};

export default {
  brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  options: {
    clientId: `ckzs_backend_${process.pid}`,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
  },
};
