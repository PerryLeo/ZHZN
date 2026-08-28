import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { Device, DeviceGroup, User } from '../models/index.js';
import { success, fail } from '../utils/response.js';

const groupInclude = (userId, isAdmin = false) => ({
  model: Device,
  as: 'devices',
    attributes: ['id', 'deviceCode', 'deviceName', 'remarkName', 'online', 'identityAbnormal'],
  where: {
    status: 1,
    ...(isAdmin ? {} : { userId }),
  },
  required: false,
  through: { attributes: [] },
});

const serializeGroup = (group) => {
  const data = group.toJSON ? group.toJSON() : group;
  const devices = Array.isArray(data.devices) ? data.devices : [];
  return {
    id: data.id,
    name: data.name,
    deviceIds: devices.map(device => device.id),
    deviceCount: devices.length,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

export const DeviceGroupController = {
  async list(req, res) {
    try {
      const operator = await User.findByPk(req.user.id, { attributes: ['role'] });
      const isAdmin = operator?.role === 'admin';
      const groups = await DeviceGroup.findAll({
        where: { userId: req.user.id },
        include: [groupInclude(req.user.id, isAdmin)],
        order: [['createdAt', 'DESC']],
      });
      return success(res, groups.map(serializeGroup));
    } catch (error) {
      return fail(res, error.message || '设备分组获取失败');
    }
  },

  async create(req, res) {
    let transaction = null;
    try {
      const name = String(req.body.name || '').trim();
      const deviceIds = [...new Set(
        (Array.isArray(req.body.deviceIds) ? req.body.deviceIds : [])
          .map(id => Number(id))
          .filter(Number.isInteger)
      )];

      if (!name) return fail(res, '请输入分组名称');
      if (name.length > 50) return fail(res, '分组名称不能超过 50 个字符');
      if (deviceIds.length === 0) return fail(res, '请至少选择一台设备');

      const operator = await User.findByPk(req.user.id, { attributes: ['role'] });
      const isAdmin = operator?.role === 'admin';

      transaction = await sequelize.transaction();

      const existing = await DeviceGroup.findOne({
        where: { userId: req.user.id, name },
        transaction,
      });
      if (existing) {
        await transaction.rollback();
        return fail(res, '分组名称已存在');
      }

      const devices = await Device.findAll({
        where: {
          id: { [Op.in]: deviceIds },
          status: 1,
          ...(isAdmin ? {} : { userId: req.user.id }),
        },
        transaction,
      });
      if (devices.length !== deviceIds.length) {
        await transaction.rollback();
        return fail(res, '包含无效设备或无权操作的设备');
      }

      const group = await DeviceGroup.create({
        name,
        userId: req.user.id,
      }, { transaction });
      await group.setDevices(devices, { transaction });
      await transaction.commit();

      const created = await DeviceGroup.findByPk(group.id, {
        include: [groupInclude(req.user.id, isAdmin)],
      });
      return success(res, serializeGroup(created), '分组创建成功', 201);
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      if (error?.name === 'SequelizeUniqueConstraintError') {
        return fail(res, '分组名称已存在');
      }
      return fail(res, error.message || '分组创建失败');
    }
  },
};
