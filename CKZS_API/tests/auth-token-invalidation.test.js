import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../src/config/index.js';
import { User } from '../src/models/index.js';
import userRoutes from '../src/routes/user.routes.js';

const app = express();
app.use(express.json());
app.use('/api/users', userRoutes);

const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseUrl = `http://127.0.0.1:${server.address().port}/api/users`;

after(async () => {
  await new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
});

const signToken = (user) => jwt.sign(
  { id: user.id, username: user.username, tokenVersion: user.tokenVersion ?? 0 },
  config.jwtSecret,
  { expiresIn: '5m' }
);

test('changePassword bumps tokenVersion and immediately invalidates old tokens', async (t) => {
  const userRecord = {
    id: 10,
    username: 'lytlj',
    role: 'admin',
    password: await bcrypt.hash('oldpass123', 10),
    tokenVersion: 0,
    async save() {
      return this;
    },
  };

  t.mock.method(User, 'findByPk', async (id) => (id === userRecord.id ? userRecord : null));

  const oldToken = signToken(userRecord);

  // 修改密码前，旧 token 可正常访问
  const beforeRes = await fetch(`${baseUrl}/profile`, {
    headers: { Authorization: `Bearer ${oldToken}` },
  });
  assert.equal(beforeRes.status, 200);

  // 调用修改密码接口
  const changeRes = await fetch(`${baseUrl}/changePassword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${oldToken}`,
    },
    body: JSON.stringify({ oldPassword: 'oldpass123', newPassword: 'newpass456' }),
  });
  assert.equal(changeRes.status, 200);
  assert.equal(userRecord.tokenVersion, 1);

  // 修改密码后，旧 token（包括管理端/其他端持有的）立刻返回 401
  const afterRes = await fetch(`${baseUrl}/profile`, {
    headers: { Authorization: `Bearer ${oldToken}` },
  });
  assert.equal(afterRes.status, 401);

  // 重新登录签发的新 token 可正常访问
  const newToken = signToken(userRecord);
  const newRes = await fetch(`${baseUrl}/profile`, {
    headers: { Authorization: `Bearer ${newToken}` },
  });
  assert.equal(newRes.status, 200);
});

test('resetPassword bumps target user tokenVersion and invalidates their old token', async (t) => {
  const adminRecord = { id: 1, username: 'admin', role: 'admin', tokenVersion: 0 };
  const targetRecord = {
    id: 2,
    username: 'normalUser',
    role: 'user',
    password: await bcrypt.hash('userpass', 10),
    tokenVersion: 0,
    async save() {
      return this;
    },
  };

  t.mock.method(User, 'findByPk', async (id) => {
    if (id === adminRecord.id) return adminRecord;
    if (id === targetRecord.id) return targetRecord;
    return null;
  });
  t.mock.method(User, 'findOne', async ({ where }) => (
    where?.username === targetRecord.username ? targetRecord : null
  ));

  const adminToken = signToken(adminRecord);
  const targetOldToken = signToken(targetRecord);

  const resetRes = await fetch(`${baseUrl}/resetPassword`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ username: targetRecord.username }),
  });
  assert.equal(resetRes.status, 200);
  assert.equal(targetRecord.tokenVersion, 1);

  // 被重置密码的用户旧 token 立刻失效
  const targetRes = await fetch(`${baseUrl}/profile`, {
    headers: { Authorization: `Bearer ${targetOldToken}` },
  });
  assert.equal(targetRes.status, 401);
});

test('username change immediately invalidates tokens issued for the old username', async (t) => {
  const userRecord = { id: 3, username: 'lytlj', role: 'admin', tokenVersion: 0 };
  t.mock.method(User, 'findByPk', async (id) => (id === userRecord.id ? userRecord : null));

  const oldUsernameToken = jwt.sign(
    { id: 3, username: 'lyz', tokenVersion: 0 },
    config.jwtSecret,
    { expiresIn: '5m' }
  );

  const res = await fetch(`${baseUrl}/profile`, {
    headers: { Authorization: `Bearer ${oldUsernameToken}` },
  });
  assert.equal(res.status, 401);
});
