import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import mqttService from './mqtt.service.js';

const TYPE_BEGIN = 0x01;
const TYPE_DATA = 0x02;
const TYPE_END = 0x03;

const FIRMWARE_DIR = path.resolve(process.env.OTA_FIRMWARE_DIR || '/opt/ota/firmware');
// MCU 的 OTA_FRAME_MAX_PAYLOAD 固定为 2048，服务端不能配置得更大。
const CHUNK_SIZE = Math.min(Math.max(Number(process.env.OTA_CHUNK_SIZE) || 1024, 64), 2048);
const ACK_TIMEOUT_MS = Math.min(Math.max(Number(process.env.OTA_ACK_TIMEOUT_MS) || 2000, 500), 30000);
const BEGIN_TIMEOUT_MS = Math.min(Math.max(Number(process.env.OTA_BEGIN_TIMEOUT_MS) || 8000, 1000), 60000);
const OTA_MODE_SETTLE_MS = Math.min(Math.max(Number(process.env.OTA_MODE_SETTLE_MS ?? 500), 0), 5000);
const BEGIN_MAX_ATTEMPTS = Math.min(Math.max(Number(process.env.OTA_BEGIN_MAX_ATTEMPTS) || 2, 1), 3);
const END_TIMEOUT_MS = Math.min(Math.max(Number(process.env.OTA_END_TIMEOUT_MS) || 15000, 1000), 120000);
const MAX_RETRY = Math.min(Math.max(Number(process.env.OTA_MAX_RETRY) || 3, 1), 10);
const MAX_TASKS = 500;

const tasks = new Map();
const activeTasks = new Map();

const crc16Ccitt = (buffer, initial = 0xFFFF) => {
  let crc = initial;
  for (const byte of buffer) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc;
};

const buildFrame = (type, offset = 0, payload = Buffer.alloc(0)) => {
  const body = Buffer.alloc(7 + payload.length);
  body.writeUInt8(type, 0);
  body.writeUInt32LE(offset, 1);
  body.writeUInt16LE(payload.length, 5);
  payload.copy(body, 7);

  const frame = Buffer.alloc(2 + body.length + 2);
  frame.writeUInt16BE(0xAA55, 0);
  body.copy(frame, 2);
  frame.writeUInt16LE(crc16Ccitt(body), 2 + body.length);
  return frame;
};

const publicTask = (task) => ({
  id: task.id,
  deviceCode: task.deviceCode,
  firmwareFile: task.firmwareFile,
  firmwareSize: task.firmwareSize,
  firmwareSha256: task.firmwareSha256,
  status: task.status,
  progress: task.progress,
  offset: task.offset,
  message: task.message,
  createdAt: task.createdAt,
  startedAt: task.startedAt,
  finishedAt: task.finishedAt,
});

const resolveFirmware = async (firmwareFile) => {
  const normalizedName = String(firmwareFile || '').trim();
  if (!normalizedName || path.basename(normalizedName) !== normalizedName || !normalizedName.toLowerCase().endsWith('.bin')) {
    throw new Error('firmwareFile 必须是固件目录中的 .bin 文件名');
  }

  const firmwarePath = path.resolve(FIRMWARE_DIR, normalizedName);
  if (!firmwarePath.startsWith(FIRMWARE_DIR + path.sep)) throw new Error('固件路径不合法');
  const stat = await fs.stat(firmwarePath);
  if (!stat.isFile() || stat.size <= 0) throw new Error('固件文件不存在或为空');
  return { firmwarePath, firmwareSize: stat.size, normalizedName };
};

const createLineReceiver = () => {
  let buffer = Buffer.alloc(0);
  let waiter = null;

  const rejectWaiter = (error) => {
    if (!waiter) return;
    clearTimeout(waiter.timer);
    const current = waiter;
    waiter = null;
    current.reject(error);
  };

  const onData = (chunk) => {
    // MQTT消息本身有边界；短ACK即使没有换行，也应当可以直接匹配。
    const directLine = chunk.toString('ascii').trim();
    if (waiter && directLine.startsWith('OTA:ERR:')) {
      rejectWaiter(new Error(`设备OTA失败：${directLine}`));
      buffer = Buffer.alloc(0);
      return true;
    }
    if (waiter && directLine && waiter.matcher(directLine)) {
      clearTimeout(waiter.timer);
      const current = waiter;
      waiter = null;
      buffer = Buffer.alloc(0);
      current.resolve(directLine);
      return true;
    }

    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > 64 * 1024) buffer = buffer.subarray(buffer.length - 64 * 1024);
    let newlineIndex = buffer.indexOf(0x0A);
    while (newlineIndex >= 0) {
      const line = buffer.subarray(0, newlineIndex).toString('ascii').trim();
      buffer = buffer.subarray(newlineIndex + 1);
      if (waiter && line.startsWith('OTA:ERR:')) {
        rejectWaiter(new Error(`设备OTA失败：${line}`));
      } else if (waiter && waiter.matcher(line)) {
        clearTimeout(waiter.timer);
        const current = waiter;
        waiter = null;
        current.resolve(line);
      }
      newlineIndex = buffer.indexOf(0x0A);
    }
    return true;
  };

  const waitForLine = (matcher, timeoutMs) => {
    if (waiter) return Promise.reject(new Error('OTA内部仍有未完成的应答等待'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiter = null;
        reject(new Error(`等待设备OTA应答超时（${timeoutMs}ms）`));
      }, timeoutMs);
      waiter = { matcher, resolve, reject, timer };
    });
  };

  return { onData, waitForLine, rejectWaiter };
};

const sendAndWait = async (deviceCode, payload, receiver, matcher, timeoutMs) => {
  const responsePromise = receiver.waitForLine(matcher, timeoutMs);
  try {
    await mqttService.publishBinary(deviceCode, payload);
  } catch (error) {
    receiver.rejectWaiter(error);
    throw error;
  }
  return responsePromise;
};

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const executeTask = async (task, firmwarePath, receiver, otaHandler) => {
  try {
    task.status = 'starting';
    task.startedAt = new Date().toISOString();
    task.message = '正在读取固件';

    const firmware = await fs.readFile(firmwarePath);
    const firmwareCrc = crc16Ccitt(firmware);
    task.firmwareSha256 = crypto.createHash('sha256').update(firmware).digest('hex');

    task.message = '正在进入升级模式';
    await sendAndWait(
      task.deviceCode,
      Buffer.from('$F\n', 'ascii'),
      receiver,
      line => line.toLowerCase().startsWith('ok'),
      5000
    );
    console.info(`[OTA] task=${task.id} device=${task.deviceCode} received Ok for $F; waiting ${OTA_MODE_SETTLE_MS}ms before BEGIN`);
    if (OTA_MODE_SETTLE_MS > 0) await delay(OTA_MODE_SETTLE_MS);

    const beginPayload = Buffer.alloc(6);
    beginPayload.writeUInt32LE(firmware.length, 0);
    beginPayload.writeUInt16LE(firmwareCrc, 4);
    task.status = 'transferring';
    task.message = '正在初始化固件传输';
    const beginFrame = buildFrame(TYPE_BEGIN, 0, beginPayload);
    let beginAcknowledged = false;
    for (let attempt = 1; attempt <= BEGIN_MAX_ATTEMPTS && !beginAcknowledged; attempt += 1) {
      console.info(`[OTA] task=${task.id} device=${task.deviceCode} BEGIN attempt=${attempt}/${BEGIN_MAX_ATTEMPTS} bytes=${beginFrame.length} firmwareSize=${firmware.length} firmwareCrc=${firmwareCrc.toString(16).padStart(4, '0')} frameHex=${beginFrame.toString('hex')}`);
      let response;
      try {
        response = await sendAndWait(
          task.deviceCode,
          beginFrame,
          receiver,
          line => line === 'OTA:ACK:0' || line === 'OTA:RETRY:0',
          BEGIN_TIMEOUT_MS
        );
      } catch (error) {
        if (!/等待设备OTA应答超时/.test(error.message) || attempt >= BEGIN_MAX_ATTEMPTS) throw error;
        console.warn(`[OTA] task=${task.id} device=${task.deviceCode} no BEGIN response; retrying attempt ${attempt + 1}/${BEGIN_MAX_ATTEMPTS}`);
        continue;
      }

      console.info(`[OTA] task=${task.id} device=${task.deviceCode} BEGIN response=${response}`);
      if (response === 'OTA:ACK:0') beginAcknowledged = true;
      else if (attempt >= BEGIN_MAX_ATTEMPTS) {
        throw new Error('设备连续返回 OTA:RETRY:0，BEGIN 帧未通过设备校验');
      }
    }
    if (!beginAcknowledged) throw new Error('设备未确认 BEGIN 帧');

    let offset = 0;
    while (offset < firmware.length) {
      let chunk = firmware.subarray(offset, Math.min(offset + CHUNK_SIZE, firmware.length));
      let acknowledged = false;

      for (let retry = 0; retry < MAX_RETRY && !acknowledged; retry += 1) {
        const expectedOffset = offset + chunk.length;
        const response = await sendAndWait(
          task.deviceCode,
          buildFrame(TYPE_DATA, offset, chunk),
          receiver,
          line => line === `OTA:ACK:${expectedOffset}` || line.startsWith('OTA:RETRY:'),
          ACK_TIMEOUT_MS
        ).catch(error => {
          if (retry + 1 >= MAX_RETRY) throw error;
          return '';
        });

        if (response === `OTA:ACK:${expectedOffset}`) {
          offset = expectedOffset;
          acknowledged = true;
        } else if (response.startsWith('OTA:RETRY:')) {
          const retryOffset = Number(response.split(':')[2]);
          if (Number.isInteger(retryOffset) && retryOffset >= 0 && retryOffset < firmware.length) {
            offset = retryOffset;
            chunk = firmware.subarray(offset, Math.min(offset + CHUNK_SIZE, firmware.length));
          }
        }
      }

      if (!acknowledged) throw new Error(`固件偏移 ${offset} 多次重传失败`);
      task.offset = offset;
      task.progress = Number(((offset / firmware.length) * 100).toFixed(1));
      task.message = `正在传输固件 ${task.progress}%`;
    }

    task.status = 'verifying';
    task.message = '设备正在校验固件';
    await sendAndWait(
      task.deviceCode,
      buildFrame(TYPE_END, firmware.length),
      receiver,
      line => line === 'OTA:READY',
      END_TIMEOUT_MS
    );

    task.status = 'rebooting';
    task.message = '设备正在重启';
    await mqttService.publishBinary(task.deviceCode, Buffer.from('$G\n', 'ascii'));

    task.status = 'success';
    task.progress = 100;
    task.message = '固件传输完成，设备已进入重启流程';
  } catch (error) {
    task.status = 'failed';
    task.message = error.message || 'OTA升级失败';
  } finally {
    task.finishedAt = new Date().toISOString();
    receiver.rejectWaiter(new Error('OTA任务已结束'));
    mqttService.unregisterOtaDataHandler(task.deviceCode, otaHandler);
    activeTasks.delete(task.deviceCode);
  }
};

const pruneTasks = () => {
  if (tasks.size < MAX_TASKS) return;
  const finished = [...tasks.values()]
    .filter(task => task.finishedAt)
    .sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)));
  while (tasks.size >= MAX_TASKS && finished.length > 0) tasks.delete(finished.shift().id);
};

const otaService = {
  async start({ deviceCode, firmwareFile, ownerId }) {
    if (!mqttService.isConnected()) throw new Error('MQTT 未连接');
    if (activeTasks.has(deviceCode) || mqttService.isOtaBusy(deviceCode)) throw new Error('该设备正在升级中');
    if (mqttService.hasPendingRawCommand(deviceCode)) throw new Error('设备正在处理上一条指令，请稍后再升级');

    const firmwareInfo = await resolveFirmware(firmwareFile);
    if (activeTasks.has(deviceCode) || mqttService.isOtaBusy(deviceCode)) throw new Error('该设备正在升级中');
    if (mqttService.hasPendingRawCommand(deviceCode)) throw new Error('设备正在处理上一条指令，请稍后再升级');
    const receiver = createLineReceiver();
    const otaHandler = raw => receiver.onData(raw);
    mqttService.registerOtaDataHandler(deviceCode, otaHandler);
    pruneTasks();
    const task = {
      id: crypto.randomUUID(),
      deviceCode,
      ownerId,
      firmwareFile: firmwareInfo.normalizedName,
      firmwareSize: firmwareInfo.firmwareSize,
      firmwareSha256: '',
      status: 'pending',
      progress: 0,
      offset: 0,
      message: '升级任务已创建',
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    };
    tasks.set(task.id, task);
    activeTasks.set(deviceCode, task.id);
    setImmediate(() => executeTask(task, firmwareInfo.firmwarePath, receiver, otaHandler));
    return publicTask(task);
  },

  getTask(taskId) {
    const task = tasks.get(taskId);
    return task ? { ...publicTask(task), ownerId: task.ownerId } : null;
  },

  isBusy(deviceCode) {
    return activeTasks.has(deviceCode) || mqttService.isOtaBusy(deviceCode);
  },
};

export { crc16Ccitt, buildFrame };
export default otaService;
