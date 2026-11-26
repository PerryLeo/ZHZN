import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import config from '../src/config/index.js';
import { Device, User } from '../src/models/index.js';
import adminRoutes from '../src/routes/admin.routes.js';
import { compareByRemarkName } from '../src/utils/naturalSort.js';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin`;

after(async () => {
  await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
});

const adminUser = { id: 1, username: 'admin', role: 'admin', tokenVersion: 0 };
const adminToken = jwt.sign(
  { id: adminUser.id, username: adminUser.username, tokenVersion: adminUser.tokenVersion },
  config.jwtSecret,
  { expiresIn: '5m' }
);

test('compareByRemarkName performs natural sorting with empty values last', () => {
  const items = [
    { id: 1, remarkName: '31' },
    { id: 2, remarkName: '6' },
    { id: 3, remarkName: '' },
    { id: 4, remarkName: '备用' },
    { id: 5, remarkName: '18' },
    { id: 6, remarkName: null },
    { id: 7, remarkName: '设备10' },
    { id: 8, remarkName: '设备2' },
  ];

  const ascNames = [...items].sort((a, b) => compareByRemarkName(a, b, 'asc')).map(item => item.remarkName);
  assert.deepEqual(ascNames, ['6', '18', '31', '备用', '设备2', '设备10', null, '']);

  const descNames = [...items].sort((a, b) => compareByRemarkName(a, b, 'desc')).map(item => item.remarkName);
  assert.deepEqual(descNames, ['设备10', '设备2', '备用', '31', '18', '6', null, '']);
});

test('GET /api/admin/devices sorts across all pages by remarkName naturally', async (t) => {
  const dataset = [
    { id: 101, remarkName: '31', deviceCode: 'C31' },
    { id: 102, remarkName: '6', deviceCode: 'C06' },
    { id: 103, remarkName: '备用', deviceCode: 'CB' },
    { id: 104, remarkName: '18', deviceCode: 'C18' },
    { id: 105, remarkName: null, deviceCode: 'CN' },
  ];

  t.mock.method(User, 'findByPk', async (id) => (id === adminUser.id ? adminUser : null));
  t.mock.method(Device, 'findAll', async (options) => {
    if (options?.raw) {
      return dataset.map(({ id, remarkName }) => ({ id, remarkName }));
    }
    const requestedIds = options?.where?.id?.[Op.in] || [];
    // Deliberately return out of order to verify controller preserves sorted pageIds order
    return dataset.filter(item => requestedIds.includes(item.id)).reverse();
  });

  const page1Res = await fetch(`${baseUrl}/devices?page=1&pageSize=2&sortBy=remarkName&sortOrder=asc`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const page1Body = await page1Res.json();
  assert.equal(page1Res.status, 200, JSON.stringify(page1Body));
  assert.equal(page1Body.data.total, 5);
  assert.deepEqual(page1Body.data.list.map(item => item.remarkName), ['6', '18']);

  const page2Res = await fetch(`${baseUrl}/devices?page=2&pageSize=2&sortBy=remarkName&sortOrder=desc`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(page2Res.status, 200);
  const page2Body = await page2Res.json();
  assert.deepEqual(page2Body.data.list.map(item => item.remarkName), ['18', '6']);

  const page3Res = await fetch(`${baseUrl}/devices?page=3&pageSize=2&sortBy=remarkName&sortOrder=desc`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(page3Res.status, 200);
  const page3Body = await page3Res.json();
  assert.deepEqual(page3Body.data.list.map(item => item.remarkName), [null]);
});
