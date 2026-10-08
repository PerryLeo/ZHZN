import { Device, User } from '../models/index.js';
import { success, fail } from '../utils/response.js';
import otaService from '../services/ota.service.js';

const getOperator = userId => User.findByPk(userId, { attributes: ['id', 'role'] });

export const OtaController = {
  async firmwares(req, res) {
    try {
      return success(res, await otaService.listFirmwareFiles());
    } catch (error) {
      return fail(res, error.message || '固件列表获取失败');
    }
  },

  async uploadFirmware(req, res) {
    try {
      const metadata = await otaService.uploadFirmware(req.body);
      return success(res, metadata, '固件上传并覆盖成功');
    } catch (error) {
      return fail(res, error.message || '固件上传失败', error.statusCode || 400);
    }
  },

  async preview(req, res) {
    try {
      return success(res, await otaService.previewBatch(req.body));
    } catch (error) {
      return fail(res, error.message || '升级范围预览失败');
    }
  },

  async createBatch(req, res) {
    try {
      const batch = await otaService.createBatch({
        ...req.body,
        operatorId: req.admin.id,
        operatorName: req.admin.username,
      });
      return success(res, batch, 'OTA批次已创建', 202);
    } catch (error) {
      const statusCode = /正在升级|正在处理上一条指令|设备正在处理/.test(error.message) ? 409 : 400;
      return fail(res, error.message || '创建OTA批次失败', statusCode);
    }
  },

  async batches(req, res) {
    try {
      return success(res, await otaService.listBatches(req.query));
    } catch (error) {
      return fail(res, error.message || 'OTA批次列表获取失败');
    }
  },

  async batch(req, res) {
    try {
      const batch = await otaService.getBatch(req.params.batchId);
      if (!batch) return fail(res, 'OTA批次不存在', 404);
      return success(res, batch);
    } catch (error) {
      return fail(res, error.message || 'OTA批次详情获取失败');
    }
  },

  async pauseBatch(req, res) {
    try {
      return success(res, await otaService.pauseBatch(req.params.batchId), '已暂停后续设备任务');
    } catch (error) {
      return fail(res, error.message || '暂停OTA批次失败', 400);
    }
  },

  async resumeBatch(req, res) {
    try {
      return success(res, await otaService.resumeBatch(req.params.batchId), '已恢复OTA队列');
    } catch (error) {
      return fail(res, error.message || '恢复OTA批次失败', 400);
    }
  },

  async retryFailed(req, res) {
    try {
      return success(res, await otaService.retryFailed(req.params.batchId), '已重新排入失败设备');
    } catch (error) {
      return fail(res, error.message || '重试OTA任务失败', 400);
    }
  },

  async start(req, res) {
    try {
      const deviceCode = String(req.body.deviceCode || '').trim();
      const firmwareFile = String(req.body.firmwareFile || '').trim();
      if (!deviceCode) return fail(res, '缺少必填参数: deviceCode');
      if (!firmwareFile) return fail(res, '缺少必填参数: firmwareFile');

      const [device, operator] = await Promise.all([
        Device.findOne({ where: { deviceCode } }),
        getOperator(req.user.id),
      ]);
      if (!device) return fail(res, '设备不存在', 404);
      if (!device.userId || device.status !== 1) return fail(res, '设备未绑定，请先绑定设备');
      if (device.online !== 1) return fail(res, '设备离线，无法升级', 409);
      if (operator?.role !== 'admin' && device.userId !== req.user.id) {
        return fail(res, '设备不属于当前用户', 403);
      }

      const task = await otaService.start({
        deviceCode,
        firmwareFile,
        ownerId: device.userId,
        operatorId: req.user.id,
      });
      return success(res, task, '升级任务已创建', 202);
    } catch (error) {
      const statusCode = /正在升级|正在处理上一条指令/.test(error.message) ? 409 : 400;
      return fail(res, error.message || '创建升级任务失败', statusCode);
    }
  },

  async task(req, res) {
    try {
      const task = await otaService.getTask(req.params.taskId);
      if (!task) return fail(res, '升级任务不存在', 404);
      const operator = await getOperator(req.user.id);
      if (operator?.role !== 'admin' && task.ownerId !== req.user.id) {
        return fail(res, '无权查看该升级任务', 403);
      }
      const { ownerId, ...result } = task;
      return success(res, result);
    } catch (error) {
      return fail(res, error.message || '查询升级任务失败');
    }
  },
};
