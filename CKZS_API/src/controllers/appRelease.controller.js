import { success, fail } from '../utils/response.js';
import service, { publicRelease } from '../services/appRelease.service.js';

const action = handler => async (req, res, next) => {
  try { await handler(req, res, next); } catch (error) {
    if (res.headersSent || res.destroyed) return;
    if (!error.statusCode) console.error('[App版本]', error.message);
    return fail(res, error.statusCode ? error.message : '版本操作失败，请稍后重试', error.statusCode || 500);
  }
};

export const AppReleaseController = {
  list: action(async (req, res) => success(res, await service.list(req.query))),
  upload: action(async (req, res) => success(res, await service.upload(req, req.admin), 'APK 已校验并保存为待发布版本', 201)),
  edit: action(async (req, res) => success(res, await service.edit(req.params.id, req.body))),
  publish: action(async (req, res) => success(res, await service.publish(req.params.id), '版本已发布')),
  withdraw: action(async (req, res) => success(res, await service.withdraw(req.params.id), '已撤回发布')),
  check: action(async (req, res) => { res.set('Cache-Control', 'no-store'); return success(res, await service.check(req.query)); }),
  detail: action(async (req, res) => { res.set('Cache-Control', 'no-store'); return success(res, publicRelease(await service.getPublic(req.params.id))); }),
  download: action(async (req, res, next) => {
    const { release, filePath } = await service.download(req.params.id);
    res.set('Cache-Control', 'no-cache');
    res.set('X-APK-SHA256', release.sha256);
    res.type('application/vnd.android.package-archive');
    res.download(filePath, `ckzs-${release.versionCode}.apk`, error => {
      if (error && !res.headersSent && !res.destroyed) next(error);
    });
  }),
};
