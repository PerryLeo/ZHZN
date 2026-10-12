import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';

// 只操作临时目录，模型查询使用 mock，不连接数据库或 MQTT。
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ckzs-ota-delete-'));
process.env.OTA_FIRMWARE_DIR = temporaryDirectory;
const { default: otaService } = await import('../src/services/ota.service.js');
const { OtaTask, OtaBatch, User } = await import('../src/models/index.js');
const { default: router } = await import('../src/routes/ota.routes.js');
const { default: config } = await import('../src/config/index.js');
const app = express();
app.use('/api/ota', router);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseUrl = `http://127.0.0.1:${server.address().port}/api/ota/firmwares/`;
const token = jwt.sign({ id: 1 }, config.jwtSecret, { expiresIn: '1m' });
const headers = { Authorization: `Bearer ${token}` };
const writeFirmware = filename => fs.writeFile(path.join(temporaryDirectory, filename), 'Ver:20261012-V2');
const deleteRequest = (filename, requestHeaders = headers) => fetch(`${baseUrl}${encodeURIComponent(filename)}`, { method: 'DELETE', headers: requestHeaders });

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test('delete requires login and a current administrator role', async t => {
  await writeFirmware('auth.pkg');
  assert.equal((await deleteRequest('auth.pkg', {})).status, 401);
  assert.equal((await deleteRequest('auth.pkg', { Authorization: 'Bearer invalid' })).status, 401);
  t.mock.method(User, 'findByPk', async () => ({ id: 1, role: 'user' }));
  assert.equal((await deleteRequest('auth.pkg')).status, 403);
  await fs.access(path.join(temporaryDirectory, 'auth.pkg'));
});

test('administrator deletes the file, lists omit it, and repeat deletion returns 404', async t => {
  t.mock.method(User, 'findByPk', async () => ({ id: 1, role: 'admin' }));
  t.mock.method(OtaTask, 'findOne', async () => null);
  t.mock.method(OtaTask, 'destroy', () => assert.fail('history must be retained'));
  t.mock.method(OtaBatch, 'destroy', () => assert.fail('history must be retained'));
  await writeFirmware('delete-me.pkg');
  const response = await deleteRequest('delete-me.pkg');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, { firmwareFile: 'delete-me.pkg' });
  await assert.rejects(fs.access(path.join(temporaryDirectory, 'delete-me.pkg')), { code: 'ENOENT' });
  assert.ok(!(await otaService.listFirmwareFiles()).some(file => file.firmwareFile === 'delete-me.pkg'));
  assert.equal((await deleteRequest('delete-me.pkg')).status, 404);
});

test('rejects traversal, invalid extensions, directories and symbolic links', async t => {
  t.mock.method(User, 'findByPk', async () => ({ id: 1, role: 'admin' }));
  for (const filename of ['', '../outside.pkg', '/tmp/outside.pkg', '..\\outside.pkg', 'file.bin', 'bad\0.pkg']) {
    await assert.rejects(otaService.deleteFirmware(filename), { statusCode: 400 });
  }
  assert.equal((await deleteRequest('../outside.pkg')).status, 400);
  await writeFirmware('keep.pkg');
  await fs.symlink(path.join(temporaryDirectory, 'keep.pkg'), path.join(temporaryDirectory, 'link.pkg'));
  await fs.mkdir(path.join(temporaryDirectory, 'directory.pkg'));
  for (const filename of ['link.pkg', 'directory.pkg']) {
    assert.equal((await deleteRequest(filename)).status, 400);
  }
  await fs.access(path.join(temporaryDirectory, 'keep.pkg'));
});

test('pending tasks including paused queues and all running stages prevent deletion', async t => {
  t.mock.method(User, 'findByPk', async () => ({ id: 1, role: 'admin' }));
  await writeFirmware('busy.pkg');
  for (const status of ['pending', 'starting', 'transferring', 'verifying', 'rebooting']) {
    const query = t.mock.method(OtaTask, 'findOne', async options => {
      assert.equal(options.where.firmwareFile, 'busy.pkg');
      return options.where.status[Op.in].includes(status) ? { id: 'busy-task' } : null;
    });
    const response = await deleteRequest('busy.pkg');
    assert.equal(response.status, 409);
    await fs.access(path.join(temporaryDirectory, 'busy.pkg'));
    query.mock.restore();
  }
});

test('deletion excludes concurrent upload, deletion, task creation, resume and retry', async t => {
  await writeFirmware('race.pkg');
  let releaseQuery;
  let queryEntered;
  const entered = new Promise(resolve => { queryEntered = resolve; });
  const blocked = new Promise(resolve => { releaseQuery = resolve; });
  t.mock.method(OtaTask, 'findOne', () => { queryEntered(); return blocked; });
  const deleting = otaService.deleteFirmware('race.pkg');
  await entered;
  try {
    for (const operation of [
      () => otaService.deleteFirmware('race.pkg'),
      () => otaService.uploadFirmware(Buffer.from('Ver:test')),
      () => otaService.start({ deviceCode: 'test', firmwareFile: 'race.pkg' }),
      () => otaService.createBatch({ firmwareFile: 'race.pkg' }),
      () => otaService.resumeBatch('test'),
      () => otaService.retryFailed('test'),
    ]) {
      await assert.rejects(operation(), { statusCode: 409 });
    }
  } finally {
    releaseQuery(null);
    await deleting;
  }
});

test('task creation lock prevents deletion until resume completes', async t => {
  await writeFirmware('resume.pkg');
  let releaseQuery;
  let queryEntered;
  const entered = new Promise(resolve => { queryEntered = resolve; });
  const blocked = new Promise(resolve => { releaseQuery = resolve; });
  t.mock.method(OtaBatch, 'findByPk', () => { queryEntered(); return blocked; });
  const resuming = otaService.resumeBatch('test');
  const failedResume = assert.rejects(resuming, /OTA批次不存在/);
  await entered;
  try {
    await assert.rejects(otaService.deleteFirmware('resume.pkg'), { statusCode: 409 });
  } finally {
    releaseQuery(null);
    await failedResume;
  }
  t.mock.method(OtaTask, 'findOne', async () => null);
  await otaService.deleteFirmware('resume.pkg');
});

test('database failure preserves file, hides details and releases deletion lock', async t => {
  await writeFirmware('error.pkg');
  t.mock.method(User, 'findByPk', async () => ({ id: 1, role: 'admin' }));
  const query = t.mock.method(OtaTask, 'findOne', async () => { throw new Error('private database failure'); });
  const response = await deleteRequest('error.pkg');
  assert.equal(response.status, 500);
  assert.equal((await response.json()).message, '固件删除失败');
  await fs.access(path.join(temporaryDirectory, 'error.pkg'));
  query.mock.restore();
  t.mock.method(OtaTask, 'findOne', async () => null);
  await otaService.deleteFirmware('error.pkg');
});
