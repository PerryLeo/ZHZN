import mqtt from 'mqtt';
import mqttConfig, { MQTT_TOPIC, parseDeviceCode } from '../config/mqtt.js';
import { Device } from '../models/index.js';

const handlers = new Map();

// 待处理指令表：commandId → { resolve, reject, timer }
const pendingCommands = new Map();

// 透传等待表：deviceCode → [{ resolve, reject, timer }]
// 硬件不回 ACK，第一条 data 上报即视为回执
const pendingRawCommands = new Map();

// OTA期间独占设备上行数据，避免普通状态上报/指令回包干扰升级ACK。
// key: deviceCode, value: async (rawBuffer, meta) => boolean
const otaDataHandlers = new Map();
// OTA结束后短暂保留设备上行原文，便于判断重启指令后的MCU反馈。
const postOtaUplinkLoggers = new Map();
const POST_OTA_UPLINK_LOG_WINDOW_MS = 30000;
const POST_OTA_UPLINK_LOG_MAX_BYTES = 512;

class MqttService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(mqttConfig.brokerUrl, mqttConfig.options);

      this.client.on('connect', () => {
        this.connected = true;
        console.log('✅ MQTT 连接成功 →', mqttConfig.brokerUrl);

        this.client.subscribe([
          MQTT_TOPIC.ALL_DATA,
          MQTT_TOPIC.ALL_ONLINE,
          MQTT_TOPIC.ALL_OFFLINE,
          MQTT_TOPIC.ALL_ACK,
        ], { qos: 1 }, (err) => {
          if (err) console.error('❌ MQTT 订阅失败:', err);
          else console.log('📡 已订阅设备通配 Topic (含ACK)');
        });

        resolve();
      });

      this.client.on('message', (topic, payload) => this._handleMessage(topic, payload));
      this.client.on('error', (err) => console.error('❌ MQTT 错误:', err));
      this.client.on('reconnect', () => console.log('🔄 MQTT 重连中...'));
      this.client.on('offline', () => { this.connected = false; });
      this.client.on('close', () => { this.connected = false; });

      setTimeout(() => {
        if (!this.connected) reject(new Error('MQTT 连接超时'));
      }, 15000);
    });
  }

  on(type, fn) { handlers.set(type, fn); }

  async _handleMessage(topic, raw) {
    const deviceCode = parseDeviceCode(topic);
    if (!deviceCode) return;

    if (topic.startsWith('test/up/') && otaDataHandlers.has(deviceCode)) {
      try { await Device.update({ updatedAt: new Date(), online: 1 }, { where: { deviceCode } }); } catch (_) {}
      const otaHandler = otaDataHandlers.get(deviceCode);
      try {
        const consumed = await otaHandler(Buffer.from(raw), {
          deviceCode,
          topic,
          timestamp: new Date().toISOString(),
        });
        if (consumed !== false) return;
      } catch (err) {
        console.error('❌ [OTA上行处理失败] '+deviceCode+':', err.message);
        return;
      }
    }

    if (topic.startsWith('test/up/')) {
      const postOtaLogger = postOtaUplinkLoggers.get(deviceCode);
      if (postOtaLogger) {
        postOtaLogger.received = true;
        const loggedBytes = raw.subarray(0, Math.min(raw.length, POST_OTA_UPLINK_LOG_MAX_BYTES));
        const truncated = raw.length > loggedBytes.length ? '...(truncated)' : '';
        console.info(`[OTA重启后MCU上行] task=${postOtaLogger.taskId} device=${deviceCode} topic=${topic} bytes=${raw.length} hex=${loggedBytes.toString('hex')}${truncated} text=${JSON.stringify(loggedBytes.toString('utf8'))}`);
      }
    }

    let payload = null;
    try { payload = JSON.parse(raw.toString()); } catch { payload = raw.toString(); }

    if (topic.includes('/command/ack')) {
      await this._handleCommandAck(deviceCode, payload, topic);
    } else if (topic.startsWith('test/up/')) {
      await this._handleDataUp(deviceCode, payload, topic);
    } else if (topic.includes('/online')) {
      await this._handleOnline(deviceCode);
    } else if (topic.includes('/offline')) {
      await this._handleOffline(deviceCode);
    }
  }

  async _handleCommandAck(deviceCode, payload, topic) {
    console.log('📨 [指令回执] '+deviceCode+':', JSON.stringify(payload));

    // 匹配待处理的指令
    if (payload && typeof payload === 'object') {
      const cmdId = payload.commandId;
      if (cmdId && pendingCommands.has(cmdId)) {
        const pending = pendingCommands.get(cmdId);
        clearTimeout(pending.timer);
        pendingCommands.delete(cmdId);
        pending.resolve({ deviceCode, ack: payload });
        return;
      }
    }

    // 没有匹配到待处理指令，触发通用回调
    const fn = handlers.get('ack');
    if (fn) await fn({ deviceCode, payload, topic, timestamp: new Date().toISOString() });
  }

  async _handleDataUp(deviceCode, payload, topic) {
    try { await Device.update({ updatedAt: new Date(), online: 1 }, { where: { deviceCode } }); } catch (_) {}

    // 优先检查是否有透传指令在等这台设备的回复
    if (pendingRawCommands.has(deviceCode)) {
      const queue = pendingRawCommands.get(deviceCode);
      const pending = queue[0];
      queue.shift();
      if (queue.length === 0) pendingRawCommands.delete(deviceCode);
      if (pending) {
        clearTimeout(pending.timer);
        console.log('📨 [透传回执] '+deviceCode+':', typeof payload === 'string' ? payload.slice(0, 100) : JSON.stringify(payload));
        pending.resolve({ deviceCode, data: payload, timestamp: new Date().toISOString() });
        return; // 本条数据已作为回执消费，不再触发通用 data 回调
      }
    }

    const fn = handlers.get('data');
    if (fn) await fn({ deviceCode, payload, topic, timestamp: new Date().toISOString() });
  }

  async _handleOnline(deviceCode) {
    try { await Device.update({ online: 1 }, { where: { deviceCode } }); } catch (_) {}
    console.log('🟢 设备上线:', deviceCode);
    const fn = handlers.get('online');
    if (fn) await fn({ deviceCode });
  }

  async _handleOffline(deviceCode) {
    try { await Device.update({ online: 0 }, { where: { deviceCode } }); } catch (_) {}
    console.log('🔴 设备离线:', deviceCode);
    const fn = handlers.get('offline');
    if (fn) await fn({ deviceCode });
  }

  // ==================== 对外 API ====================

  /** 下发指令并等待回执（同步模式）*/
  publishCommandAndWait(deviceCode, command, timeoutMs = 10000) {
    if (!this.connected || !this.client) throw new Error('MQTT 未连接');

    const commandId = Date.now()+'_'+Math.random().toString(36).slice(2,8);
    const topic = MQTT_TOPIC.COMMAND_DOWN(deviceCode);
    const payload = JSON.stringify({
      commandId,
      ...command,
      timestamp: new Date().toISOString(),
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingCommands.delete(commandId);
        reject(new Error('指令超时（'+timeoutMs+'ms 内未收到回执）'));
      }, timeoutMs);

      pendingCommands.set(commandId, { resolve, reject, timer });

      this.client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timer);
          pendingCommands.delete(commandId);
          reject(err);
        }
      });
    });
  }

  /** 下发指令（异步模式，不等待回执）*/
  publishCommand(deviceCode, command) {
    if (!this.connected || !this.client) throw new Error('MQTT 未连接');
    const topic = MQTT_TOPIC.COMMAND_DOWN(deviceCode);
    const payload = JSON.stringify({
      commandId: Date.now()+'_'+Math.random().toString(36).slice(2,8),
      ...command,
      timestamp: new Date().toISOString(),
    });
    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve({ topic, payload: JSON.parse(payload) });
      });
    });
  }

  /**
   * 透传模式：直接下发纯文本字符串给硬件，并等待硬件在 data 频道的第一条回复。
   * 适用于不支持 JSON ACK 协议的老式 DTU/4G 模块。
   * @param {string} deviceCode  设备编号
   * @param {string} rawData     要发送的原始字符串，如 "$b"
   * @param {number} timeoutMs   等待超时（毫秒）
   */
  publishRawCommandAndWait(deviceCode, rawData, timeoutMs = 10000) {
    if (!this.connected || !this.client) throw new Error('MQTT 未连接');
    const topic = MQTT_TOPIC.COMMAND_DOWN(deviceCode);

    // deviceCode 即 IMEI，与 _handleDataUp 中 parseDeviceCode 返回的值一致
    const queueKey = deviceCode;

    // 老协议的 data 回包不带命令标识；同一设备同时等待两条指令时，无法可靠区分回包归属。
    if (pendingRawCommands.has(queueKey)) {
      throw new Error('设备正在处理上一条指令，请稍后重试');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingRawCommands.has(queueKey)) {
          const queue = pendingRawCommands.get(queueKey);
          const idx = queue.findIndex(p => p.timer === timer);
          if (idx !== -1) queue.splice(idx, 1);
          if (queue.length === 0) pendingRawCommands.delete(queueKey);
        }
        reject(new Error('透传指令超时（'+timeoutMs+'ms 内未收到设备数据上报）'));
      }, timeoutMs);

      // 入队（用固定 key，与 _handleDataUp 一致）
      if (!pendingRawCommands.has(queueKey)) pendingRawCommands.set(queueKey, []);
      pendingRawCommands.get(queueKey).push({ resolve, reject, timer });

      // 发送纯文本
      this.client.publish(topic, rawData, { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timer);
          const queue = pendingRawCommands.get(queueKey) || [];
          const idx = queue.findIndex(p => p.timer === timer);
          if (idx !== -1) queue.splice(idx, 1);
          reject(err);
        } else {
          console.log('📤 [透传下发] '+deviceCode+' → topic:', topic, '| data:', rawData);
        }
      });
    });
  }

  /** 透传下发（异步，不等回执）*/
  publishRaw(deviceCode, rawData) {
    if (!this.connected || !this.client) throw new Error('MQTT 未连接');
    const topic = MQTT_TOPIC.COMMAND_DOWN(deviceCode);
    return new Promise((resolve, reject) => {
      this.client.publish(topic, rawData, { qos: 1 }, (err) => {
        if (err) reject(err);
        else {
          console.log('📤 [透传下发] '+deviceCode+' →', rawData);
          resolve({ topic });
        }
      });
    });
  }

  /** OTA二进制帧下发，payload保持Buffer原样发送。*/
  publishBinary(deviceCode, payload, qos = 1) {
    if (!this.connected || !this.client) throw new Error('MQTT 未连接');
    if (!Buffer.isBuffer(payload)) throw new Error('OTA payload 必须是 Buffer');
    const topic = MQTT_TOPIC.COMMAND_DOWN(deviceCode);
    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, { qos }, (err) => {
        if (err) reject(err);
        else {
          const loggedBytes = payload.subarray(0, Math.min(payload.length, 32));
          const truncated = payload.length > loggedBytes.length ? '...(truncated)' : '';
          console.info(`📤 [OTA下行Broker确认] device=${deviceCode} topic=${topic} qos=${qos} bytes=${payload.length} hex=${loggedBytes.toString('hex')}${truncated}`);
          resolve({ topic, bytes: payload.length });
        }
      });
    });
  }

  /** 注册单设备OTA独占上行处理器。*/
  registerOtaDataHandler(deviceCode, handler) {
    if (otaDataHandlers.has(deviceCode)) throw new Error('该设备正在升级中');
    this.stopPostOtaUplinkLogging(deviceCode);
    otaDataHandlers.set(deviceCode, handler);
  }

  /** $G下发后采集一段时间的设备上行原文，不拦截正常数据处理。*/
  watchPostOtaUplinks(deviceCode, taskId) {
    this.stopPostOtaUplinkLogging(deviceCode);
    const logger = { taskId, received: false, timer: null };
    logger.timer = setTimeout(() => {
      if (postOtaUplinkLoggers.get(deviceCode) !== logger) return;
      postOtaUplinkLoggers.delete(deviceCode);
      if (!logger.received) {
        console.warn(`[OTA重启后MCU上行] task=${taskId} device=${deviceCode} ${POST_OTA_UPLINK_LOG_WINDOW_MS}ms内未收到设备上行`);
      }
    }, POST_OTA_UPLINK_LOG_WINDOW_MS);
    logger.timer.unref?.();
    postOtaUplinkLoggers.set(deviceCode, logger);
    console.info(`[OTA重启后MCU上行] task=${taskId} device=${deviceCode} 开始采集，窗口=${POST_OTA_UPLINK_LOG_WINDOW_MS}ms`);
  }

  stopPostOtaUplinkLogging(deviceCode) {
    const logger = postOtaUplinkLoggers.get(deviceCode);
    if (!logger) return;
    clearTimeout(logger.timer);
    postOtaUplinkLoggers.delete(deviceCode);
  }

  unregisterOtaDataHandler(deviceCode, handler) {
    if (!handler || otaDataHandlers.get(deviceCode) === handler) {
      otaDataHandlers.delete(deviceCode);
    }
  }

  isOtaBusy(deviceCode) { return otaDataHandlers.has(deviceCode); }
  hasPendingRawCommand(deviceCode) { return pendingRawCommands.has(deviceCode); }

  isConnected() { return this.connected; }
  disconnect() { if (this.client) { this.client.end(true); this.connected = false; } }
}

const mqttService = new MqttService();
export default mqttService;
