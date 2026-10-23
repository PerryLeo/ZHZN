import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { AppRelease } from '../models/index.js';
import sequelize from '../config/database.js';
import { inspectApk } from '../utils/apk.js';

const DIRECTORY = path.resolve(process.env.APP_RELEASE_DIR || '/opt/ckzs/app-releases');
export const APK_MAX_SIZE = 200 * 1024 * 1024;
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
let mutating = false;
const exclusive = async action => {
  if (mutating) fail('已有版本操作正在处理，请稍后重试', 409);
  mutating = true;
  try { return await action(); } finally { mutating = false; }
};

export const publicRelease = row => ({
  id: row.id, packageName: row.packageName, versionName: row.versionName,
  versionCode: Number(row.versionCode), minSdkVersion: row.minSdkVersion,
  fileSize: Number(row.fileSize), sha256: row.sha256,
  forceUpdate: Boolean(row.forceUpdate), publishedAt: row.publishedAt,
  downloadUrl: `/api/app/releases/${row.id}/download`,
});

const appReleaseService = {
  async list(query = {}) {
    const page = Math.max(1, Math.min(Number.parseInt(query.page, 10) || 1, 100000));
    const pageSize = 20;
    const result = await AppRelease.findAndCountAll({ order: [['versionCode', 'DESC']], limit: pageSize, offset: (page - 1) * pageSize });
    return { list: result.rows, total: result.count, page, pageSize, totalPages: Math.ceil(result.count / pageSize) };
  },

  async upload(request, admin) {
    return exclusive(async () => {
      if (!request.is('application/octet-stream')) fail('请使用 application/octet-stream 上传 APK');
      if (Number(request.headers['content-length']) > APK_MAX_SIZE) fail('APK 不能超过 200 MB', 413);
      await fs.mkdir(DIRECTORY, { recursive: true });
      const id = crypto.randomUUID();
      const temporaryPath = path.join(DIRECTORY, `.upload-${id}.tmp`);
      const fileName = `${id}.apk`;
      const finalPath = path.join(DIRECTORY, fileName);
      let saved = false;
      try {
        let fileSize = 0;
        const hash = crypto.createHash('sha256');
        const meter = new Transform({ transform(chunk, encoding, callback) {
          fileSize += chunk.length;
          if (fileSize > APK_MAX_SIZE) return callback(Object.assign(new Error('APK 不能超过 200 MB'), { statusCode: 413 }));
          hash.update(chunk);
          callback(null, chunk);
        } });
        await pipeline(request, meter, createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 }));
        if (!fileSize) fail('请选择非空 APK 文件');
        let metadata;
        try { metadata = inspectApk(await fs.readFile(temporaryPath)); } catch (error) {
          fail(`APK 校验失败：${error.message}`);
        }
        if (await AppRelease.findOne({ where: { versionCode: metadata.versionCode } })) fail('该 versionCode 已上传，请递增版本号后重新打包', 409);
        const existing = await AppRelease.findOne({ order: [['versionCode', 'DESC']] });
        if (existing && existing.packageName !== metadata.packageName) fail('APK 包名与已有 App 不一致');
        if (existing && existing.certificateSha256 !== metadata.certificateSha256) fail('APK 签名与已有版本不一致，无法覆盖更新');
        await fs.rename(temporaryPath, finalPath);
        const release = await AppRelease.create({ id, ...metadata, fileName, fileSize, sha256: hash.digest('hex'), operatorId: admin.id, operatorName: admin.username });
        saved = true;
        return release;
      } finally {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        if (!saved) await fs.rm(finalPath, { force: true }).catch(() => {});
      }
    });
  },

  async edit(id, body) {
    return exclusive(async () => {
      const release = await AppRelease.findByPk(id);
      if (!release) fail('版本不存在', 404);
      if (!['draft', 'withdrawn'].includes(release.status)) fail('请先撤回发布，再修改更新方式', 409);
      if (typeof body.forceUpdate !== 'boolean') fail('请指定更新方式');
      return release.update({ forceUpdate: body.forceUpdate });
    });
  },

  async publish(id) {
    return exclusive(async () => sequelize.transaction(async transaction => {
      const releases = await AppRelease.findAll({ transaction, lock: transaction.LOCK.UPDATE });
      const release = releases.find(item => item.id === id);
      if (!release) fail('版本不存在', 404);
      if (release.status === 'published') return release;
      if (!['draft', 'withdrawn'].includes(release.status)) fail('历史归档版本不能重新发布，请递增版本号发布修复版', 409);
      const published = releases.filter(item => item.status === 'published');
      if (releases.some(item => item.id !== release.id && item.publishedAt && item.versionCode >= release.versionCode)) fail('发布版本号必须大于历史已发布版本，请递增版本号发布修复版', 409);
      const file = await fs.stat(path.join(DIRECTORY, release.fileName)).catch(() => null);
      if (!file?.isFile() || file.size !== Number(release.fileSize)) fail('APK 文件缺失或大小已变化，无法发布');
      const hash = crypto.createHash('sha256').update(await fs.readFile(path.join(DIRECTORY, release.fileName))).digest('hex');
      if (hash !== release.sha256) fail('APK 文件校验失败，无法发布');
      for (const previous of published) await previous.update({ status: 'archived' }, { transaction });
      return release.update({ status: 'published', publishedAt: new Date() }, { transaction });
    }));
  },

  async withdraw(id) {
    return exclusive(async () => {
      const release = await AppRelease.findByPk(id);
      if (!release) fail('版本不存在', 404);
      if (release.status !== 'published') fail('只有已发布版本可以撤回', 409);
      return release.update({ status: 'withdrawn' });
    });
  },

  async check(query) {
    const versionCode = Number(query.versionCode);
    if (!Number.isInteger(versionCode) || versionCode <= 0 || !/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/.test(query.packageName || '')) fail('缺少有效的 packageName 或 versionCode');
    const release = await AppRelease.findOne({ where: { packageName: query.packageName, status: 'published' }, order: [['versionCode', 'DESC']] });
    const sdkVersion = Number(query.sdkVersion);
    if (!release || Number(release.versionCode) <= versionCode || (sdkVersion > 0 && sdkVersion < release.minSdkVersion)) return { hasUpdate: false, release: null };
    return { hasUpdate: true, release: publicRelease(release) };
  },

  async getPublic(id) {
    const release = await AppRelease.findOne({ where: { id, status: 'published' } });
    if (!release) fail('版本不存在或已撤回发布', 404);
    return release;
  },

  async download(id) {
    const release = await this.getPublic(id);
    return this.downloadRelease(release);
  },

  async downloadLatest() {
    const release = await AppRelease.findOne({ where: { status: 'published' }, order: [['versionCode', 'DESC']] });
    if (!release) fail('暂无已发布的 App 版本', 404);
    return this.downloadRelease(release);
  },

  async downloadRelease(release) {
    const filePath = path.join(DIRECTORY, release.fileName);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat?.isFile() || stat.size !== Number(release.fileSize)) fail('APK 文件不存在或已损坏', 404);
    return { release, filePath };
  },
};

export default appReleaseService;
