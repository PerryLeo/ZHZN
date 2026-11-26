import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ckzs-ota-concurrency-'));
process.env.OTA_FIRMWARE_DIR = temporaryDirectory;
process.env.OTA_MAX_CONCURRENCY = '2';
process.env.OTA_MODE_SETTLE_MS = '0';
process.env.OTA_CHUNK_SIZE = '64';

const { default: otaService } = await import('../src/services/ota.service.js');
const { default: mqttService } = await import('../src/services/mqtt.service.js');
const { Device, OtaBatch, OtaTask } = await import('../src/models/index.js');

const firmwareContent = Buffer.concat([Buffer.from('Ver:20261126-V3\n'), Buffer.alloc(128, 0x41)]);
const firmwareFile = 'concurrent-test.pkg';
await fs.writeFile(path.join(temporaryDirectory, firmwareFile), firmwareContent);

after(async () => {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

const waitFor = async (predicate, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('等待条件超时');
};

const setupBatchMocks = (t, deviceCodes) => {
  const batches = new Map();
  const tasks = new Map();
  const otaHandlers = new Map();
  let batchSeq = 1;
  let taskSeq = 1;

  const makeBatchRecord = (data) => ({
    ...data,
    async update(updates) {
      Object.assign(this, updates);
      batches.set(this.id, this);
      return this;
    },
  });

  t.mock.method(mqttService, 'isConnected', () => true);
  t.mock.method(mqttService, 'isOtaBusy', deviceCode => otaHandlers.has(deviceCode));
  t.mock.method(mqttService, 'hasPendingRawCommand', () => false);
  t.mock.method(mqttService, 'watchPostOtaUplinks', () => {});
  t.mock.method(mqttService, 'registerOtaDataHandler', (deviceCode, handler) => {
    if (otaHandlers.has(deviceCode)) throw new Error('该设备正在升级中');
    otaHandlers.set(deviceCode, handler);
  });
  t.mock.method(mqttService, 'unregisterOtaDataHandler', (deviceCode, handler) => {
    if (!handler || otaHandlers.get(deviceCode) === handler) otaHandlers.delete(deviceCode);
  });

  t.mock.method(Device, 'findAll', async () => deviceCodes.map((deviceCode, index) => ({
    id: index + 1,
    deviceCode,
    deviceName: `设备-${deviceCode}`,
    remarkName: `设备-${deviceCode}`,
    userId: 1,
    online: 1,
    status: 1,
    owner: { id: 1, username: 'admin' },
  })));
  t.mock.method(Device, 'findOne', async ({ where }) => (
    deviceCodes.includes(where.deviceCode) ? { id: 1, deviceCode: where.deviceCode, online: 1, status: 1 } : null
  ));

  t.mock.method(OtaBatch, 'create', async (data) => {
    const record = makeBatchRecord({
      id: `batch-${batchSeq++}`,
      isPaused: false,
      successCount: 0,
      failedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    });
    batches.set(record.id, record);
    return record;
  });
  t.mock.method(OtaBatch, 'findByPk', async (id) => batches.get(id) || null);

  t.mock.method(OtaTask, 'bulkCreate', async (items) => items.map(item => {
    const plain = {
      id: `task-${taskSeq++}`,
      progress: 0,
      offset: 0,
      retryCount: 0,
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
      ...item,
    };
    tasks.set(plain.id, plain);
    return { ...plain, get: () => ({ ...plain }) };
  }));
  t.mock.method(OtaTask, 'update', async (updates, { where }) => {
    const task = tasks.get(where.id);
    if (task) Object.assign(task, updates);
    return [1];
  });
  t.mock.method(OtaTask, 'findAll', async ({ where }) => {
    return [...tasks.values()]
      .filter(task => (!where.batchId || task.batchId === where.batchId) && (!where.status || task.status === where.status))
      .map(task => ({ ...task, get: () => ({ ...task }) }));
  });

  return { batches, tasks, otaHandlers };
};

const respondToFrame = (otaHandlers, deviceCode, payload) => {
  const handler = otaHandlers.get(deviceCode);
  if (!handler) return;
  const text = payload.toString('ascii');
  if (text === '$F\n') {
    queueMicrotask(() => handler(Buffer.from('Ok\n'), { topic: `test/up/${deviceCode}` }));
    return;
  }
  if (text === '$G\n') return;
  const type = payload.readUInt8(2);
  const offset = payload.readUInt32LE(3);
  const length = payload.readUInt16LE(7);
  if (type === 0x01) {
    queueMicrotask(() => handler(Buffer.from('OTA:ACK:0\n'), { topic: `test/up/${deviceCode}` }));
  } else if (type === 0x02) {
    queueMicrotask(() => handler(Buffer.from(`OTA:ACK:${offset + length}\n`), { topic: `test/up/${deviceCode}` }));
  } else if (type === 0x03) {
    queueMicrotask(() => handler(Buffer.from('OTA:READY\n'), { topic: `test/up/${deviceCode}` }));
  }
};

test('runs up to OTA_MAX_CONCURRENCY devices concurrently and completes all devices', async t => {
  const deviceCodes = ['DEV001', 'DEV002', 'DEV003', 'DEV004'];
  const { batches, tasks, otaHandlers } = setupBatchMocks(t, deviceCodes);

  let peakConcurrent = 0;
  const activeDevices = new Set();
  const pendingReleases = new Map();

  t.mock.method(mqttService, 'publishBinary', async (deviceCode, payload) => {
    const text = payload.toString('ascii');
    if (text === '$F\n') {
      activeDevices.add(deviceCode);
      peakConcurrent = Math.max(peakConcurrent, activeDevices.size);
      // 先挂起前两台的 $F 应答，验证两台确实并发运行且第三台未提前启动。
      if (pendingReleases.size < 2) {
        await new Promise(resolve => pendingReleases.set(deviceCode, resolve));
      }
    }
    if (text === '$G\n') {
      activeDevices.delete(deviceCode);
    }
    respondToFrame(otaHandlers, deviceCode, payload);
    return { topic: `test/down/${deviceCode}`, bytes: payload.length };
  });

  const batch = await otaService.createBatch({
    scope: 'all',
    firmwareFile,
    operatorId: 1,
    operatorName: 'admin',
  });

  await waitFor(() => pendingReleases.size === 2);
  assert.equal(activeDevices.size, 2);
  assert.equal(peakConcurrent, 2);

  for (const release of pendingReleases.values()) release();

  await waitFor(() => batches.get(batch.id)?.status === 'success');
  const finishedBatch = batches.get(batch.id);
  assert.equal(finishedBatch.successCount, 4);
  assert.equal(finishedBatch.failedCount, 0);
  assert.equal(finishedBatch.skippedCount, 0);
  assert.equal(peakConcurrent, 2);
  for (const task of tasks.values()) {
    assert.equal(task.status, 'success');
    assert.equal(task.progress, 100);
  }
});

test('pauseBatch lets in-flight devices finish without starting queued ones until resumed', async t => {
  const deviceCodes = ['DEV101', 'DEV102', 'DEV103'];
  const { batches, tasks, otaHandlers } = setupBatchMocks(t, deviceCodes);

  const startedDevices = [];
  const pendingReleases = new Map();

  t.mock.method(mqttService, 'publishBinary', async (deviceCode, payload) => {
    if (payload.toString('ascii') === '$F\n') {
      startedDevices.push(deviceCode);
      if (pendingReleases.size < 2) {
        await new Promise(resolve => pendingReleases.set(deviceCode, resolve));
      }
    }
    respondToFrame(otaHandlers, deviceCode, payload);
    return { topic: `test/down/${deviceCode}`, bytes: payload.length };
  });

  const batch = await otaService.createBatch({
    scope: 'all',
    firmwareFile,
    operatorId: 1,
    operatorName: 'admin',
  });

  await waitFor(() => pendingReleases.size === 2);
  await otaService.pauseBatch(batch.id);

  for (const release of pendingReleases.values()) release();

  await waitFor(() => [...tasks.values()].filter(item => item.status === 'success').length === 2);
  await new Promise(resolve => setTimeout(resolve, 50));

  // 第 3 台设备在暂停状态下不应启动
  assert.deepEqual(startedDevices.sort(), ['DEV101', 'DEV102']);
  assert.equal(batches.get(batch.id).status, 'paused');

  await otaService.resumeBatch(batch.id);
  await waitFor(() => batches.get(batch.id)?.status === 'success');
  assert.equal(batches.get(batch.id).successCount, 3);
  assert.deepEqual(startedDevices.sort(), ['DEV101', 'DEV102', 'DEV103']);
});
