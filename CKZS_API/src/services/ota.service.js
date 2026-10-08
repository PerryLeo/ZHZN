import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import mqttService from './mqtt.service.js';
import { Op } from 'sequelize';
import { Device, User, OtaBatch, OtaTask } from '../models/index.js';

const TYPE_BEGIN = 0x01;
const TYPE_DATA = 0x02;
const TYPE_END = 0x03;

const FIRMWARE_DIR = path.resolve(process.env.OTA_FIRMWARE_DIR || '/opt/ota/firmware');
// MCU 的 OTA_FRAME_MAX_PAYLOAD 固定为 2048，服务端不能配置得更大。
const CHUNK_SIZE = Math.min(Math.max(Number(process.env.OTA_CHUNK_SIZE) || 1024, 64), 2048);
const ACK_TIMEOUT_MS = Math.min(Math.max(Number(process.env.OTA_ACK_TIMEOUT_MS) || 5000, 500), 30000);
const BEGIN_TIMEOUT_MS = Math.min(Math.max(Number(process.env.OTA_BEGIN_TIMEOUT_MS) || 8000, 1000), 60000);
const OTA_MODE_SETTLE_MS = Math.min(Math.max(Number(process.env.OTA_MODE_SETTLE_MS ?? 500), 0), 5000);
const BEGIN_MAX_ATTEMPTS = Math.min(Math.max(Number(process.env.OTA_BEGIN_MAX_ATTEMPTS) || 2, 1), 3);
const END_TIMEOUT_MS = Math.min(Math.max(Number(process.env.OTA_END_TIMEOUT_MS) || 15000, 1000), 120000);
const MAX_RETRY = Math.min(Math.max(Number(process.env.OTA_MAX_RETRY) || 3, 1), 10);
const OTA_UPLINK_LOG_MAX_BYTES = 512;
const queue = [];
const queuedTaskIds = new Set();
const activeTasks = new Map();
let queueRunning = false;
let firmwareUploadInProgress = false;
let taskCreationCount = 0;

const acquireTaskCreation = () => {
  if (firmwareUploadInProgress) {
    const error = new Error('固件正在上传覆盖，请稍后再创建 OTA 任务');
    error.statusCode = 409;
    throw error;
  }
  taskCreationCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    taskCreationCount -= 1;
  };
};

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
  batchId: task.batchId,
  deviceCode: task.deviceCode,
  ownerId: task.ownerId,
  ownerName: task.ownerName,
  operatorId: task.operatorId,
  firmwareFile: task.firmwareFile,
  firmwareVersion: task.firmwareVersion,
  firmwareSize: task.firmwareSize,
  firmwareSha256: task.firmwareSha256,
  status: task.status,
  progress: task.progress,
  offset: task.offset,
  message: task.message,
  retryCount: task.retryCount,
  createdAt: task.createdAt,
  startedAt: task.startedAt,
  finishedAt: task.finishedAt,
});

const publicBatch = (batch) => ({
  id: batch.id,
  operatorId: batch.operatorId,
  operatorName: batch.operatorName,
  scope: batch.scope,
  targetUserId: batch.targetUserId,
  targetUserName: batch.targetUserName,
  firmwareFile: batch.firmwareFile,
  firmwareVersion: batch.firmwareVersion,
  firmwareSize: batch.firmwareSize,
  firmwareSha256: batch.firmwareSha256,
  status: batch.status,
  isPaused: batch.isPaused,
  targetCount: batch.targetCount,
  eligibleCount: batch.eligibleCount,
  skippedCount: batch.skippedCount,
  successCount: batch.successCount,
  failedCount: batch.failedCount,
  createdAt: batch.createdAt,
  updatedAt: batch.updatedAt,
});

const resolveFirmware = async (firmwareFile) => {
  const normalizedName = String(firmwareFile || '').trim();
  const lowerCaseName = normalizedName.toLowerCase();
  if (!normalizedName || path.basename(normalizedName) !== normalizedName || (!lowerCaseName.endsWith('.bin') && !lowerCaseName.endsWith('.pkg'))) {
    throw new Error('firmwareFile 必须是固件目录中的 .bin 或 .pkg 文件名');
  }

  const firmwarePath = path.resolve(FIRMWARE_DIR, normalizedName);
  if (!firmwarePath.startsWith(FIRMWARE_DIR + path.sep)) throw new Error('固件路径不合法');
  const stat = await fs.stat(firmwarePath);
  if (!stat.isFile() || stat.size <= 0) throw new Error('固件文件不存在或为空');
  const firmware = await fs.readFile(firmwarePath);
  const versionMatch = firmware.toString('latin1').match(/Ver[:= ]*([A-Za-z0-9._-]+)/i);
  return {
    firmwarePath,
    firmwareSize: stat.size,
    firmwareSha256: crypto.createHash('sha256').update(firmware).digest('hex'),
    firmwareVersion: versionMatch?.[1] || '',
    normalizedName,
  };
};

const listFirmwares = async () => {
  const entries = await fs.readdir(FIRMWARE_DIR, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile() && /\.(bin|pkg)$/i.test(entry.name));
  const result = await Promise.all(files.map(async (entry) => {
    const info = await resolveFirmware(entry.name);
    const stat = await fs.stat(info.firmwarePath);
    return {
      firmwareFile: info.normalizedName,
      firmwareVersion: info.firmwareVersion,
      firmwareSize: info.firmwareSize,
      firmwareSha256: info.firmwareSha256,
      updatedAt: stat.mtime.toISOString(),
    };
  }));
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

const readFirmwareMetadata = (firmwareBuffer, firmwareFile) => {
  const versionMatch = firmwareBuffer.toString('latin1').match(/Ver[:= ]*([A-Za-z0-9._-]+)/i);
  return {
    firmwareFile,
    firmwareVersion: versionMatch?.[1] || '',
    firmwareSize: firmwareBuffer.length,
    firmwareSha256: crypto.createHash('sha256').update(firmwareBuffer).digest('hex'),
  };
};

const persistTask = async (task, updates) => {
  Object.assign(task, updates);
  await OtaTask.update(updates, { where: { id: task.id } });
  return task;
};

const summarizeBatch = async (batchId) => {
  const batch = await OtaBatch.findByPk(batchId);
  if (!batch) return null;
  const rows = await OtaTask.findAll({ where: { batchId }, attributes: ['status'], raw: true });
  const count = status => rows.filter(row => row.status === status).length;
  const successCount = count('success');
  const failedCount = count('failed');
  const skippedCount = count('skipped');
  const unfinishedCount = rows.length - successCount - failedCount - skippedCount;
  let status = 'running';
  if (batch.isPaused) status = 'paused';
  else if (unfinishedCount === 0) {
    if (successCount === 0 && failedCount === 0) status = 'skipped';
    else if (failedCount === 0 && skippedCount === 0) status = 'success';
    else if (successCount === 0) status = 'failed';
    else status = 'partial';
  } else if (rows.every(row => row.status === 'pending' || row.status === 'skipped')) status = 'queued';
  await batch.update({ status, successCount, failedCount, skippedCount });
  return batch;
};

const enqueueTask = (task, firmwarePath) => {
  if (queuedTaskIds.has(task.id)) return;
  queuedTaskIds.add(task.id);
  queue.push({ task, firmwarePath });
  pumpQueue();
};

const pumpQueue = () => {
  if (queueRunning) return;
  const runnableIndex = queue.findIndex(({ task }) => !task.batchId || !pausedBatchIds.has(task.batchId));
  if (runnableIndex < 0) return;
  const [job] = queue.splice(runnableIndex, 1);
  queuedTaskIds.delete(job.task.id);
  queueRunning = true;
  executeTask(job.task, job.firmwarePath)
    .catch(error => console.error(`[OTA] task=${job.task.id} queue error:`, error.message))
    .finally(() => {
      queueRunning = false;
      pumpQueue();
    });
};

const pausedBatchIds = new Set();

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

const executeTask = async (task, firmwarePath) => {
  const receiver = createLineReceiver();
  const otaHandler = (raw, meta) => {
    const loggedBytes = raw.subarray(0, Math.min(raw.length, OTA_UPLINK_LOG_MAX_BYTES));
    const truncated = raw.length > loggedBytes.length ? '...(truncated)' : '';
    console.info(`[OTA原始上行] task=${task.id} device=${task.deviceCode} topic=${meta?.topic || `test/up/${task.deviceCode}`} bytes=${raw.length} hex=${loggedBytes.toString('hex')}${truncated} text=${JSON.stringify(loggedBytes.toString('utf8'))}`);
    return receiver.onData(raw);
  };
  let handlerRegistered = false;
  try {
    const currentDevice = await Device.findOne({
      where: { deviceCode: task.deviceCode, status: 1, online: 1 },
      attributes: ['id'],
    });
    if (!currentDevice) {
      await persistTask(task, { status: 'skipped', message: '设备当前离线或未绑定，已跳过', finishedAt: new Date() });
      return;
    }
    mqttService.registerOtaDataHandler(task.deviceCode, otaHandler);
    handlerRegistered = true;
    await persistTask(task, {
      status: 'starting',
      startedAt: new Date(),
      message: '正在读取固件',
      firmwareSha256: task.firmwareSha256 || '',
    });

    const firmware = await fs.readFile(firmwarePath);
    const firmwareCrc = crc16Ccitt(firmware);
    const firmwareSha256 = crypto.createHash('sha256').update(firmware).digest('hex');
    if (task.firmwareSha256 && task.firmwareSha256 !== firmwareSha256) {
      throw new Error('固件文件内容已变化，请重新创建升级任务');
    }

    await persistTask(task, { firmwareSha256, message: '正在进入升级模式' });
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
    await persistTask(task, { status: 'transferring', message: '正在初始化固件传输' });
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
      const progress = Number(((offset / firmware.length) * 100).toFixed(1));
      await persistTask(task, { offset, progress, message: `正在传输固件 ${progress}%` });
    }

    await persistTask(task, { status: 'verifying', message: '设备正在校验固件' });
    await sendAndWait(
      task.deviceCode,
      buildFrame(TYPE_END, firmware.length),
      receiver,
      line => line === 'OTA:READY',
      END_TIMEOUT_MS
    );

    await persistTask(task, { status: 'rebooting', message: '设备正在重启' });
    await mqttService.publishBinary(task.deviceCode, Buffer.from('$G\n', 'ascii'));
    mqttService.watchPostOtaUplinks(task.deviceCode, task.id);

    await persistTask(task, {
      status: 'success',
      progress: 100,
      message: '固件传输完成，设备已进入重启流程',
      finishedAt: new Date(),
    });
  } catch (error) {
    await persistTask(task, {
      status: 'failed',
      message: error.message || 'OTA升级失败',
      finishedAt: new Date(),
    }).catch(persistError => console.error(`[OTA] task=${task.id} status persist failed:`, persistError.message));
  } finally {
    receiver.rejectWaiter(new Error('OTA任务已结束'));
    if (handlerRegistered) mqttService.unregisterOtaDataHandler(task.deviceCode, otaHandler);
    activeTasks.delete(task.deviceCode);
    if (task.batchId) await summarizeBatch(task.batchId).catch(error => console.error(`[OTA] batch=${task.batchId} summary failed:`, error.message));
  }
};

const getTargets = async ({ scope, targetUserId, deviceCode, deviceCodes }) => {
  let where = { status: 1 };
  let targetUser = null;
  if (scope === 'user') {
    const parsedUserId = Number(targetUserId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) throw new Error('请选择目标用户');
    targetUser = await User.findByPk(parsedUserId, { attributes: ['id', 'username', 'role'] });
    if (!targetUser || targetUser.role !== 'user') throw new Error('目标用户不存在或不是 APP 用户');
    where.userId = targetUser.id;
  } else if (scope === 'device') {
    const normalizedCode = String(deviceCode || '').trim();
    if (!normalizedCode) throw new Error('请选择目标设备');
    where.deviceCode = normalizedCode;
  } else if (scope !== 'all') {
    throw new Error('升级范围无效');
  }

  if (scope === 'user' && Array.isArray(deviceCodes)) {
    if (deviceCodes.length === 0) throw new Error('请至少选择一台目标设备');
    const normalizedCodes = [...new Set(deviceCodes.map(value => String(value || '').trim()).filter(Boolean))];
    if (normalizedCodes.length !== deviceCodes.length) throw new Error('设备列表中存在空值或重复项');
    where.deviceCode = { [Op.in]: normalizedCodes };
  }

  const devices = await Device.findAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'username'] }],
    order: [['deviceCode', 'ASC']],
  });
  if (!devices.length) throw new Error('当前范围没有已绑定设备');
  if (scope === 'user' && Array.isArray(deviceCodes) && devices.length !== deviceCodes.length) {
    throw new Error('所选设备中包含不属于该用户或未绑定的设备，请刷新后重试');
  }
  return { devices, targetUser };
};

const shapeTarget = device => ({
  deviceCode: device.deviceCode,
  remarkName: device.remarkName || device.deviceName || '',
  ownerId: device.userId,
  ownerName: device.owner?.username || '',
  online: Number(device.online) === 1,
  eligible: Number(device.online) === 1,
  reason: Number(device.online) === 1 ? '' : '设备当前离线',
});

const otaService = {
  async listFirmwareFiles() {
    return listFirmwares();
  },

  async uploadFirmware(firmwareBuffer) {
    if (!Buffer.isBuffer(firmwareBuffer) || firmwareBuffer.length === 0) throw new Error('请选择非空固件文件');
    if (firmwareUploadInProgress) {
      const error = new Error('已有固件上传正在处理，请稍后重试');
      error.statusCode = 409;
      throw error;
    }
    firmwareUploadInProgress = true;
    try {
      if (taskCreationCount > 0) {
        const error = new Error('正在创建 OTA 任务，请稍后再覆盖固件');
        error.statusCode = 409;
        throw error;
      }
      const inFlightStatuses = ['pending', 'starting', 'transferring', 'verifying', 'rebooting'];
      if (await OtaTask.count({ where: { status: { [Op.in]: inFlightStatuses } } })) {
        const error = new Error('存在待执行或执行中的 OTA 任务，请等待任务结束后再覆盖固件');
        error.statusCode = 409;
        throw error;
      }

      const firmwareFile = 'lobster-feeder.pkg';
      const metadata = readFirmwareMetadata(firmwareBuffer, firmwareFile);
      await fs.mkdir(FIRMWARE_DIR, { recursive: true });
      const targetPath = path.join(FIRMWARE_DIR, firmwareFile);
      const temporaryPath = path.join(FIRMWARE_DIR, `.${firmwareFile}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
      let fileHandle;
      try {
        fileHandle = await fs.open(temporaryPath, 'wx', 0o644);
        await fileHandle.writeFile(firmwareBuffer);
        await fileHandle.sync();
        await fileHandle.close();
        fileHandle = null;
        await fs.rename(temporaryPath, targetPath);
      } catch (error) {
        if (fileHandle) await fileHandle.close().catch(() => {});
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
      }
      return metadata;
    } finally {
      firmwareUploadInProgress = false;
    }
  },

  async previewBatch(options) {
    const firmware = await resolveFirmware(options.firmwareFile);
    const { devices, targetUser } = await getTargets(options);
    const targets = devices.map(shapeTarget);
    return {
      firmware: {
        firmwareFile: firmware.normalizedName,
        firmwareVersion: firmware.firmwareVersion,
        firmwareSize: firmware.firmwareSize,
        firmwareSha256: firmware.firmwareSha256,
      },
      scope: options.scope,
      targetUser: targetUser ? { id: targetUser.id, username: targetUser.username } : null,
      targetCount: targets.length,
      eligibleCount: targets.filter(item => item.eligible).length,
      skippedCount: targets.filter(item => !item.eligible).length,
      devices: targets,
    };
  },

  async createBatch({ scope, targetUserId, deviceCode, deviceCodes, firmwareFile, operatorId, operatorName }) {
    const releaseTaskCreation = acquireTaskCreation();
    try {
    if (!mqttService.isConnected()) throw new Error('MQTT 未连接');
    const firmware = await resolveFirmware(firmwareFile);
    const { devices, targetUser } = await getTargets({ scope, targetUserId, deviceCode, deviceCodes });
    const batch = await OtaBatch.create({
      operatorId,
      operatorName,
      scope,
      targetUserId: targetUser?.id || null,
      targetUserName: targetUser?.username || null,
      firmwareFile: firmware.normalizedName,
      firmwareVersion: firmware.firmwareVersion,
      firmwareSize: firmware.firmwareSize,
      firmwareSha256: firmware.firmwareSha256,
      targetCount: devices.length,
      eligibleCount: devices.filter(device => Number(device.online) === 1).length,
      skippedCount: devices.filter(device => Number(device.online) !== 1).length,
      status: devices.some(device => Number(device.online) === 1) ? 'queued' : 'skipped',
    });

    const tasks = await OtaTask.bulkCreate(devices.map(device => ({
      batchId: batch.id,
      operatorId,
      deviceCode: device.deviceCode,
      ownerId: device.userId,
      ownerName: device.owner?.username || null,
      firmwareFile: firmware.normalizedName,
      firmwareVersion: firmware.firmwareVersion,
      firmwareSize: firmware.firmwareSize,
      firmwareSha256: firmware.firmwareSha256,
      status: Number(device.online) === 1 ? 'pending' : 'skipped',
      message: Number(device.online) === 1 ? '等待升级队列' : '设备当前离线，已跳过',
    })));

    for (const taskRecord of tasks) {
      const task = taskRecord.get({ plain: true });
      if (task.status !== 'pending') continue;
      if (activeTasks.has(task.deviceCode) || mqttService.isOtaBusy(task.deviceCode) || mqttService.hasPendingRawCommand(task.deviceCode)) {
        await persistTask(task, { status: 'skipped', message: '设备正在处理其他任务，已跳过' });
        continue;
      }
      activeTasks.set(task.deviceCode, task.id);
      enqueueTask(task, firmware.firmwarePath);
    }
    await summarizeBatch(batch.id);
    return this.getBatch(batch.id);
    } finally {
      releaseTaskCreation();
    }
  },

  async start({ deviceCode, firmwareFile, ownerId, operatorId = ownerId, operatorName = null }) {
    const releaseTaskCreation = acquireTaskCreation();
    try {
    if (!mqttService.isConnected()) throw new Error('MQTT 未连接');
    if (activeTasks.has(deviceCode) || mqttService.isOtaBusy(deviceCode)) throw new Error('该设备正在升级中');
    if (mqttService.hasPendingRawCommand(deviceCode)) throw new Error('设备正在处理上一条指令，请稍后再升级');

    const firmwareInfo = await resolveFirmware(firmwareFile);
    if (activeTasks.has(deviceCode) || mqttService.isOtaBusy(deviceCode)) throw new Error('该设备正在升级中');
    if (mqttService.hasPendingRawCommand(deviceCode)) throw new Error('设备正在处理上一条指令，请稍后再升级');
    const taskRecord = await OtaTask.create({
      operatorId,
      deviceCode,
      ownerId,
      ownerName: null,
      firmwareFile: firmwareInfo.normalizedName,
      firmwareVersion: firmwareInfo.firmwareVersion,
      firmwareSize: firmwareInfo.firmwareSize,
      firmwareSha256: firmwareInfo.firmwareSha256,
      status: 'pending',
      progress: 0,
      offset: 0,
      message: '升级任务已创建',
    });
    const task = taskRecord.get({ plain: true });
    activeTasks.set(deviceCode, task.id);
    enqueueTask(task, firmwareInfo.firmwarePath);
    return publicTask(task);
    } finally {
      releaseTaskCreation();
    }
  },

  async getTask(taskId) {
    const task = await OtaTask.findByPk(taskId);
    return task ? publicTask(task) : null;
  },

  async listBatches({ page = 1, pageSize = 10, status = '' } = {}) {
    const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const safePageSize = Math.min(Math.max(Number.parseInt(pageSize, 10) || 10, 1), 100);
    const { rows, count } = await OtaBatch.findAndCountAll({
      where: status ? { status } : {},
      order: [['createdAt', 'DESC']],
      limit: safePageSize,
      offset: (safePage - 1) * safePageSize,
    });
    return { list: rows.map(publicBatch), total: count, page: safePage, pageSize: safePageSize, totalPages: Math.ceil(count / safePageSize) };
  },

  async getBatch(batchId) {
    const batch = await OtaBatch.findByPk(batchId);
    if (!batch) return null;
    const tasks = await OtaTask.findAll({ where: { batchId }, order: [['createdAt', 'ASC']] });
    return { ...publicBatch(batch), tasks: tasks.map(publicTask) };
  },

  async pauseBatch(batchId) {
    const batch = await OtaBatch.findByPk(batchId);
    if (!batch) throw new Error('OTA批次不存在');
    if (!['queued', 'running'].includes(batch.status)) throw new Error('当前批次状态不支持暂停');
    await batch.update({ isPaused: true, status: 'paused' });
    pausedBatchIds.add(batchId);
    return this.getBatch(batchId);
  },

  async resumeBatch(batchId) {
    const batch = await OtaBatch.findByPk(batchId);
    if (!batch) throw new Error('OTA批次不存在');
    if (batch.status !== 'paused') throw new Error('当前批次未暂停');
    if (!mqttService.isConnected()) throw new Error('MQTT 未连接');
    const firmware = await resolveFirmware(batch.firmwareFile);
    await batch.update({ isPaused: false });
    pausedBatchIds.delete(batchId);
    const pendingTasks = await OtaTask.findAll({ where: { batchId, status: 'pending' }, order: [['createdAt', 'ASC']] });
    for (const record of pendingTasks) {
      const task = record.get({ plain: true });
      if (queuedTaskIds.has(task.id)) continue;
      if (activeTasks.has(task.deviceCode) || mqttService.isOtaBusy(task.deviceCode) || mqttService.hasPendingRawCommand(task.deviceCode)) {
        await persistTask(task, { status: 'skipped', message: '设备正在处理其他任务，已跳过' });
        continue;
      }
      activeTasks.set(task.deviceCode, task.id);
      enqueueTask(task, firmware.firmwarePath);
    }
    await summarizeBatch(batchId);
    pumpQueue();
    return this.getBatch(batchId);
  },

  async retryFailed(batchId) {
    const releaseTaskCreation = acquireTaskCreation();
    try {
    const batch = await OtaBatch.findByPk(batchId);
    if (!batch) throw new Error('OTA批次不存在');
    if (!mqttService.isConnected()) throw new Error('MQTT 未连接');
    const failedTasks = await OtaTask.findAll({ where: { batchId, status: 'failed' }, order: [['createdAt', 'ASC']] });
    if (!failedTasks.length) throw new Error('当前批次没有失败任务');
    const firmware = await resolveFirmware(batch.firmwareFile);
    await batch.update({ isPaused: false });
    pausedBatchIds.delete(batchId);
    for (const record of failedTasks) {
      const task = record.get({ plain: true });
      const device = await Device.findOne({ where: { deviceCode: task.deviceCode, status: 1 } });
      if (!device || Number(device.online) !== 1) {
        await persistTask(task, { status: 'skipped', message: '设备当前离线或未绑定，重试已跳过', finishedAt: new Date() });
        continue;
      }
      await persistTask(task, { status: 'pending', progress: 0, offset: 0, message: '等待重试', retryCount: Number(task.retryCount || 0) + 1, startedAt: null, finishedAt: null });
      if (activeTasks.has(task.deviceCode) || mqttService.isOtaBusy(task.deviceCode) || mqttService.hasPendingRawCommand(task.deviceCode)) {
        await persistTask(task, { status: 'skipped', message: '设备正在处理其他任务，重试已跳过', finishedAt: new Date() });
        continue;
      }
      activeTasks.set(task.deviceCode, task.id);
      enqueueTask(task, firmware.firmwarePath);
    }
    await summarizeBatch(batchId);
    pumpQueue();
    return this.getBatch(batchId);
    } finally {
      releaseTaskCreation();
    }
  },

  async recoverAfterRestart() {
    await OtaTask.update({ status: 'failed', message: 'API服务重启导致任务中断，请在管理端重试', finishedAt: new Date() }, {
      where: { status: { [Op.in]: ['starting', 'transferring', 'verifying', 'rebooting'] } },
    });
    await OtaTask.update({ status: 'failed', message: 'API服务重启前任务尚未开始，请重新提交', finishedAt: new Date() }, {
      where: { batchId: null, status: 'pending' },
    });
    const pendingBatches = await OtaBatch.findAll({
      where: { status: { [Op.in]: ['queued', 'running'] } },
      attributes: ['id'],
    });
    for (const batch of pendingBatches) {
      pausedBatchIds.add(batch.id);
      await OtaBatch.update({ isPaused: true, status: 'paused' }, { where: { id: batch.id } });
      await summarizeBatch(batch.id);
    }
  },

  isBusy(deviceCode) {
    return activeTasks.has(deviceCode) || mqttService.isOtaBusy(deviceCode);
  },
};

export { crc16Ccitt, buildFrame };
export default otaService;
