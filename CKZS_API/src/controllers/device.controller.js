import { Op } from 'sequelize';
import { Device, User } from '../models/index.js';
import { success, fail } from '../utils/response.js';
import mqttService from '../services/mqtt.service.js';

const BATCH_CONCURRENCY = 50;
const STATUS_QUERY_LIMIT = 10;
const ADMIN_STATUS_QUERY_LIMIT = 200;
const ADMIN_STATUS_QUERY_CONCURRENCY = 100;

export const DeviceController = {
  async sendCommand(req, res) {
    try {
      const { deviceCode, type, params, timeout } = req.body;
      if (!deviceCode) return fail(res, '缺少必填参数: deviceCode');
      if (!type) return fail(res, '缺少必填参数: type');

      const device = await Device.findOne({ where: { deviceCode } });
      if (!device) return fail(res, '设备不存在', 404);
      if (!device.userId || device.status !== 1) return fail(res, '设备未绑定，请先绑定设备');
      if (device.online !== 1) return fail(res, '设备离线，无法下发指令', 409);
      if (mqttService.isOtaBusy(deviceCode)) return fail(res, '设备正在升级，暂时无法下发其他指令', 409);

      const operator = await User.findByPk(req.user.id, { attributes: ['id', 'role'] });
      const isAdmin = operator?.role === 'admin';
      if (!isAdmin && device.userId !== req.user.id) return fail(res, '设备不属于当前用户', 403);

      let result;

      // 透传模式：硬件不支持 JSON ACK，直接下发原始字符串并等待 data 频道回复
      if (type === 'send') {
        const rawData = (params && params.data) ? String(params.data) + '\n' : '';
        if (!rawData.trim()) return fail(res, '透传模式缺少 params.data 字段');
        result = await mqttService.publishRawCommandAndWait(deviceCode, rawData, timeout || 10000);
        return success(res, result, '透传指令已发送，已收到设备回复');
      }

      // 普通 JSON 指令模式：硬件支持回退 commandId 的 ACK
      result = await mqttService.publishCommandAndWait(
        deviceCode,
        { type, params: params || {} },
        timeout || 10000
      );

      return success(res, result, '指令 [' + type + '] 已执行，收到回执');
    } catch (err) {
      return fail(res, err.message || '指令下发失败');
    }
  },

  // ==================== 批量下发指令（纯异步，不等回执，适合大批量）====================
  async batchCommand(req, res) {
    try {
      const { deviceCodes, type, params } = req.body;
      if (!deviceCodes || !Array.isArray(deviceCodes) || deviceCodes.length === 0) {
        return fail(res, '缺少必填参数: deviceCodes（非空数组）');
      }
      if (deviceCodes.length > 5000) {
        return fail(res, '单次批量下发不超过 5000 台设备');
      }
      if (!type) return fail(res, '缺少必填参数: type');

      const uniqueCodes = [...new Set(deviceCodes.map(code => String(code || '').trim()).filter(Boolean))];
      if (uniqueCodes.length !== deviceCodes.length) {
        return fail(res, 'deviceCodes 中存在空值或重复设备编码');
      }

      const operator = await User.findByPk(req.user.id, { attributes: ['id', 'role'] });
      const isAdmin = operator?.role === 'admin';
      const allowedDevices = await Device.findAll({
        where: {
          deviceCode: { [Op.in]: uniqueCodes },
          status: 1,
          ...(isAdmin ? {} : { userId: req.user.id }),
        },
        attributes: ['deviceCode'],
      });
      if (allowedDevices.length !== uniqueCodes.length) {
        return fail(res, '部分设备不存在、未绑定或无操作权限', 403);
      }

      // 并发提交给 MQTT，只统计提交结果，不等待设备回执。
      let total = 0;
      let failedCount = 0;
      let upgradingCount = 0;
      for (let i = 0; i < uniqueCodes.length; i += BATCH_CONCURRENCY) {
        const batch = uniqueCodes.slice(i, i + BATCH_CONCURRENCY);
        const results = await Promise.allSettled(batch.map(async code => {
          if (mqttService.isOtaBusy(code)) {
            upgradingCount += 1;
            return false;
          }
          if (type === 'send') {
            await mqttService.publishRaw(code, String(params?.data || ''));
          } else {
            await mqttService.publishCommand(code, { type, params: params || {} });
          }
          return true;
        }));
        for (const result of results) {
          if (result.status === 'rejected') failedCount += 1;
          else if (result.value) total += 1;
        }
      }

      return success(res, { total, failedCount, upgradingCount }, `已提交 ${total} 台设备的指令`);
    } catch (err) {
      return fail(res, err.message || '批量下发失败');
    }
  },

  // ==================== 批量查询设备状态（等待各设备回复）====================
  async batchQueryStatus(req, res) {
    try {
      const deviceCodes = Array.isArray(req.body.deviceCodes) ? req.body.deviceCodes : [];
      const uniqueCodes = [...new Set(deviceCodes.map(code => String(code || '').trim()).filter(Boolean))];
      const timeout = Math.min(Math.max(Number(req.body.timeout) || 5000, 1000), 10000);

      if (uniqueCodes.length === 0) return fail(res, '缺少必填参数: deviceCodes（非空数组）');
      if (uniqueCodes.length !== deviceCodes.length) return fail(res, 'deviceCodes 中存在空值或重复设备编码');
      const operator = await User.findByPk(req.user.id, { attributes: ['id', 'role'] });
      const isAdmin = operator?.role === 'admin';
      const queryLimit = isAdmin ? ADMIN_STATUS_QUERY_LIMIT : STATUS_QUERY_LIMIT;
      if (uniqueCodes.length > queryLimit) {
        return fail(res, `单次最多查询 ${queryLimit} 台设备`);
      }

      const allowedDevices = await Device.findAll({
        where: {
          deviceCode: { [Op.in]: uniqueCodes },
          ...(isAdmin ? {} : { status: 1, userId: req.user.id }),
        },
        attributes: ['deviceCode', 'online'],
      });
      if (allowedDevices.length !== uniqueCodes.length) {
        return fail(res, '部分设备不存在、未绑定或无操作权限', 403);
      }

      const otaBusyCodes = new Set(uniqueCodes.filter(code => mqttService.isOtaBusy(code)));
      if (!isAdmin && otaBusyCodes.size > 0) {
        return fail(res, '部分设备正在升级，暂时无法查询状态', 409);
      }

      const queryableCodes = uniqueCodes.filter(code => !otaBusyCodes.has(code));
      const resultMap = new Map();
      const deviceOnlineMap = new Map(allowedDevices.map(d => [d.deviceCode, Number(d.online) === 1]));
      for (const code of otaBusyCodes) {
        resultMap.set(code, {
          deviceCode: code,
          success: deviceOnlineMap.get(code) ?? true,
          otaBusy: true,
          error: '设备正在升级',
        });
      }

      const concurrency = isAdmin ? ADMIN_STATUS_QUERY_CONCURRENCY : STATUS_QUERY_LIMIT;
      for (let i = 0; i < queryableCodes.length; i += concurrency) {
        const chunk = queryableCodes.slice(i, i + concurrency);
        const settled = await Promise.allSettled(
          chunk.map(deviceCode =>
            mqttService.publishRawCommandAndWait(deviceCode, '$c\n', timeout)
          )
        );
        settled.forEach((result, index) => {
          const deviceCode = chunk[index];
          if (result.status === 'fulfilled') {
            resultMap.set(deviceCode, {
              ...result.value,
              deviceCode,
              success: true,
            });
          } else {
            resultMap.set(deviceCode, {
              deviceCode,
              success: false,
              error: result.reason?.message || '设备状态查询失败',
            });
          }
        });
      }

      const results = uniqueCodes.map(code => resultMap.get(code));
      const onlineCodes = results.filter(item => item.success && !item.otaBusy).map(item => item.deviceCode);
      const offlineCodes = results.filter(item => !item.success && !item.otaBusy).map(item => item.deviceCode);

      const onlineUpdates = [];
      if (onlineCodes.length > 0) {
        onlineUpdates.push(Device.update(
          { online: 1 },
          { where: { deviceCode: { [Op.in]: onlineCodes } } }
        ));
      }
      if (offlineCodes.length > 0) {
        onlineUpdates.push(Device.update(
          { online: 0 },
          { where: { deviceCode: { [Op.in]: offlineCodes } } }
        ));
      }
      await Promise.all(onlineUpdates);

      return success(res, {
        total: results.length,
        successCount: onlineCodes.length,
        failureCount: offlineCodes.length,
        results,
      }, '批量设备状态查询完成');
    } catch (err) {
      return fail(res, err.message || '批量设备状态查询失败');
    }
  },
};
