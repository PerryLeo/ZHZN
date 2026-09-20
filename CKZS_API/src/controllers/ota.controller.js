import { Device, User } from '../models/index.js';
import { success, fail } from '../utils/response.js';
import otaService from '../services/ota.service.js';

const getOperator = userId => User.findByPk(userId, { attributes: ['id', 'role'] });

export const OtaController = {
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
      });
      return success(res, task, '升级任务已创建', 202);
    } catch (error) {
      const statusCode = /正在升级|正在处理上一条指令/.test(error.message) ? 409 : 400;
      return fail(res, error.message || '创建升级任务失败', statusCode);
    }
  },

  async task(req, res) {
    try {
      const task = otaService.getTask(req.params.taskId);
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
