import { Device } from '../models/index.js';
import { success, fail } from '../utils/response.js';
import mqttService from '../services/mqtt.service.js';

const BATCH_CONCURRENCY = 50;

export const DeviceController = {
  async sendCommand(req, res) {
    try {
      const { deviceCode, type, params, timeout } = req.body;
      if (!deviceCode) return fail(res, '缺少必填参数: deviceCode');
      if (!type) return fail(res, '缺少必填参数: type');

      const device = await Device.findOne({ where: { deviceCode } });
      if (!device) return fail(res, '设备不存在', 404);
      if (!device.userId || device.status !== 1) return fail(res, '设备未绑定，请先绑定设备');
      if (device.userId !== req.user.id) return fail(res, '设备不属于当前用户');

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

      // 纯异步 fire-and-forget：并发 publish 到各设备 MQTT topic，不等回执
      const total = deviceCodes.length;
      for (let i = 0; i < deviceCodes.length; i += BATCH_CONCURRENCY) {
        const batch = deviceCodes.slice(i, i + BATCH_CONCURRENCY);
        await Promise.all(batch.map(code => {
          try {
            if (type === 'send') {
              return mqttService.publishRaw(code, String(params?.data || '') + '\n');
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
};
