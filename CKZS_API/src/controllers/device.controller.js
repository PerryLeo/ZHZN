import { Op } from 'sequelize';
import { Device, User } from '../models/index.js';
import { success, fail } from '../utils/response.js';
import mqttService from '../services/mqtt.service.js';

const BATCH_CONCURRENCY = 50;
const STATUS_QUERY_LIMIT = 10;

const getRawField = (rawData, field) => {
  const match = String(rawData || '').match(new RegExp('(?:^|[|\\r\\n])\\s*' + field + '\\s*:\\s*([^|\\r\\n]+)', 'i'));
  return match ? match[1].trim() : '';
};

const buildStatusPayloadValidator = (expectedDevice) => (payload) => {
  const rawData = typeof payload === 'string' ? payload : '';
  const imei = getRawField(rawData, 'IMEI');
  return imei === String(expectedDevice.deviceCode).trim();
};

export const DeviceController = {
  async sendCommand(req, res) {
    try {
      const { deviceCode, type, params, timeout } = req.body;
      if (!deviceCode) return fail(res, '缺少必填参数: deviceCode');
      if (!type) return fail(res, '缺少必填参数: type');

      const device = await Device.findOne({ where: { deviceCode } });
      if (!device) return fail(res, '设备不存在', 404);
      if (!device.userId || device.status !== 1) return fail(res, '设备未绑定，请先绑定设备');

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

      // 纯异步 fire-and-forget：并发 publish 到各设备 MQTT topic，不等回执
      const total = uniqueCodes.length;
      for (let i = 0; i < uniqueCodes.length; i += BATCH_CONCURRENCY) {
        const batch = uniqueCodes.slice(i, i + BATCH_CONCURRENCY);
        await Promise.all(batch.map(code => {
          try {
            if (type === 'send') {
              return mqttService.publishRaw(code, String(params?.data || ''));
            }
            return mqttService.publishCommand(code, { type, params: params || {} });
          } catch {
            return Promise.resolve();
          }
        }));
      }

      return success(res, { total }, `批量下发完成，已向 ${total} 台设备发送指令`);
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
      if (uniqueCodes.length > STATUS_QUERY_LIMIT) {
        return fail(res, `单次最多查询 ${STATUS_QUERY_LIMIT} 台设备`);
      }

      const operator = await User.findByPk(req.user.id, { attributes: ['id', 'role'] });
      const isAdmin = operator?.role === 'admin';
      const allowedDevices = await Device.findAll({
        where: {
          deviceCode: { [Op.in]: uniqueCodes },
          ...(isAdmin ? {} : { status: 1, userId: req.user.id }),
        },
        attributes: ['deviceCode'],
      });
      if (allowedDevices.length !== uniqueCodes.length) {
        return fail(res, '部分设备不存在、未绑定或无操作权限', 403);
      }

      const settled = await Promise.allSettled(
        uniqueCodes.map(deviceCode => {
          const device = allowedDevices.find(item => item.deviceCode === deviceCode);
          return mqttService.publishRawCommandAndWait(
            deviceCode,
            '$c\n',
            timeout,
            buildStatusPayloadValidator(device)
          );
        })
      );
      const results = settled.map((result, index) => {
        const deviceCode = uniqueCodes[index];
        if (result.status === 'fulfilled') {
          return { deviceCode, success: true, ...result.value };
        }
        return {
          deviceCode,
          success: false,
          identityMismatch: result.reason?.code === 'IDENTITY_MISMATCH',
          error: result.reason?.message || '设备状态查询失败',
        };
      });
      const successCount = results.filter(item => item.success).length;
      const onlineCodes = results.filter(item => item.success || item.identityMismatch).map(item => item.deviceCode);
      const offlineCodes = results.filter(item => !item.success && !item.identityMismatch).map(item => item.deviceCode);

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
        successCount,
        failureCount: results.length - successCount,
        results,
      }, '批量设备状态查询完成');
    } catch (err) {
      return fail(res, err.message || '批量设备状态查询失败');
    }
  },
};
