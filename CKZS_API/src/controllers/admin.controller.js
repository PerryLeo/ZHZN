import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { Device, User, DeviceGroup, DeviceGroupMember } from '../models/index.js';
import { fail, paginate, success } from '../utils/response.js';

const getPagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(Number.parseInt(query.pageSize, 10) || 10, 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
};

export const AdminController = {
  async dashboard(req, res) {
    try {
      const [userTotal, deviceTotal, boundTotal, onlineTotal, identityAbnormalTotal, recentDevices, typeGroups] = await Promise.all([
        User.count(),
        Device.count(),
        Device.count({ where: { status: 1 } }),
        Device.count({ where: { online: 1, identityAbnormal: 0 } }),
        Device.count({ where: { identityAbnormal: 1 } }),
        Device.findAll({
          limit: 6,
          order: [['updatedAt', 'DESC']],
          include: [{ model: User, as: 'owner', attributes: ['id', 'username'] }],
        }),
        Device.findAll({
          attributes: [
            'deviceType',
            [Device.sequelize.fn('COUNT', Device.sequelize.col('id')), 'count'],
          ],
          group: ['deviceType'],
          raw: true,
        }),
      ]);

      return success(res, {
        totals: {
          users: userTotal,
          devices: deviceTotal,
          bound: boundTotal,
          unbound: Math.max(deviceTotal - boundTotal, 0),
          online: onlineTotal,
          identityAbnormal: identityAbnormalTotal,
          offline: Math.max(deviceTotal - onlineTotal - identityAbnormalTotal, 0),
        },
        deviceTypes: typeGroups.map(item => ({
          type: item.deviceType || 'unknown',
          count: Number(item.count),
        })),
        recentDevices,
      });
    } catch (error) {
      return fail(res, error.message || '统计数据获取失败');
    }
  },

  async users(req, res) {
    try {
      const { page, pageSize, offset } = getPagination(req.query);
      const keyword = String(req.query.keyword || '').trim();
      const role = String(req.query.role || '').trim();
      const where = {
        ...(keyword ? { username: { [Op.like]: `%${keyword}%` } } : {}),
        ...(role ? { role } : {}),
      };
      const { rows, count } = await User.findAndCountAll({
        where,
        attributes: { exclude: ['password'] },
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset,
      });

      const userIds = rows.map(item => item.id);
      const deviceCounts = userIds.length ? await Device.findAll({
        attributes: [
          'userId',
          [Device.sequelize.fn('COUNT', Device.sequelize.col('id')), 'count'],
        ],
        where: { userId: { [Op.in]: userIds } },
        group: ['userId'],
        raw: true,
      }) : [];
      const countMap = new Map(deviceCounts.map(item => [Number(item.userId), Number(item.count)]));
      const list = rows.map(item => ({
        ...item.toJSON(),
        deviceCount: countMap.get(item.id) || 0,
      }));

      return paginate(res, { list, total: count, page, pageSize });
    } catch (error) {
      return fail(res, error.message || '用户列表获取失败');
    }
  },

  async userDevices(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        attributes: ['id', 'username', 'role'],
      });
      if (!user) return fail(res, '用户不存在', 404);

      const devices = await Device.findAll({
        where: { userId: user.id },
        order: [['bindAt', 'DESC']],
      });
      return success(res, { user, devices });
    } catch (error) {
      return fail(res, error.message || '用户设备获取失败');
    }
  },

  async devices(req, res) {
    try {
      const { page, pageSize, offset } = getPagination(req.query);
      const keyword = String(req.query.keyword || '').trim();
      const where = {};
      const groupId = Number.parseInt(req.query.groupId, 10);

      if (Number.isInteger(groupId) && groupId > 0) {
        const group = await DeviceGroup.findOne({
          where: { id: groupId, userId: req.user.id },
          attributes: ['id'],
        });
        if (!group) return fail(res, '设备分组不存在或不属于当前管理员', 404);

        const members = await DeviceGroupMember.findAll({
          where: { groupId },
          attributes: ['deviceId'],
        });
        where.id = { [Op.in]: members.map(member => member.deviceId) };
      }

      if (keyword) {
        where[Op.or] = [
          { deviceCode: { [Op.like]: `%${keyword}%` } },
          { deviceName: { [Op.like]: `%${keyword}%` } },
        ];
      }
      if (req.query.status !== undefined && req.query.status !== '') {
        where.status = Number(req.query.status) === 1 ? 1 : 0;
      }
      if (req.query.online !== undefined && req.query.online !== '') {
        where.online = Number(req.query.online) === 1 ? 1 : 0;
      }
      if (req.query.identityAbnormal !== undefined && req.query.identityAbnormal !== '') {
        where.identityAbnormal = Number(req.query.identityAbnormal) === 1 ? 1 : 0;
      }
      if (req.query.deviceType) where.deviceType = req.query.deviceType;
      if (req.query.userId) where.userId = Number(req.query.userId);
      const { rows, count } = await Device.findAndCountAll({
        where,
        include: [{ model: User, as: 'owner', attributes: ['id', 'username'] }],
        order: [['updatedAt', 'DESC']],
        limit: pageSize,
        offset,
        distinct: true,
      });
      return paginate(res, { list: rows, total: count, page, pageSize });
    } catch (error) {
      return fail(res, error.message || '设备列表获取失败');
    }
  },

  async createDevice(req, res) {
    try {
      const deviceCode = String(req.body.deviceCode || '').trim();
      const deviceName = String(req.body.deviceName || deviceCode).trim();
      const deviceType = String(req.body.deviceType || 'dtu').trim();
      if (!deviceCode) return fail(res, '设备编码不能为空');
      if (await Device.findOne({ where: { deviceCode } })) return fail(res, '设备编码已存在');

      const device = await Device.create({
        deviceCode,
        deviceName,
        deviceType,
        status: 0,
        online: 0,
      });
      return success(res, device, '设备创建成功', 201);
    } catch (error) {
      return fail(res, error.message || '设备创建失败');
    }
  },

  async updateDevice(req, res) {
    try {
      const device = await Device.findByPk(req.params.id);
      if (!device) return fail(res, '设备不存在', 404);

      const remarkName = String(req.body.remarkName ?? device.remarkName ?? '').trim();
      const deviceType = String(req.body.deviceType ?? device.deviceType ?? 'dtu').trim();
      if (!deviceType) return fail(res, '设备类型不能为空');

      device.remarkName = remarkName || null;
      device.deviceType = deviceType;
      await device.save();
      return success(res, device, '设备信息更新成功');
    } catch (error) {
      return fail(res, error.message || '设备信息更新失败');
    }
  },

  async deleteDevice(req, res) {
    let transaction = null;
    try {
      transaction = await sequelize.transaction();
      const device = await Device.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!device) {
        await transaction.rollback();
        return fail(res, '设备不存在', 404);
      }
      if (device.userId || device.status === 1) {
        await transaction.rollback();
        return fail(res, '设备已绑定，请先解绑后再删除', 409);
      }

      await DeviceGroupMember.destroy({
        where: { deviceId: device.id },
        transaction,
      });
      await device.destroy({ transaction });
      await transaction.commit();
      return success(res, null, '设备删除成功');
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      return fail(res, error.message || '设备删除失败');
    }
  },

  async bindDevice(req, res) {
    let transaction = null;
    try {
      transaction = await sequelize.transaction();
      const device = await Device.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!device) {
        await transaction.rollback();
        return fail(res, '设备不存在', 404);
      }

      const user = await User.findByPk(Number(req.body.userId), { transaction });
      if (!user) {
        await transaction.rollback();
        return fail(res, '绑定用户不存在', 404);
      }

      if (device.userId && device.userId !== user.id) {
        await DeviceGroupMember.destroy({
          where: { deviceId: device.id },
          transaction,
        });
      }
      device.userId = user.id;
      device.status = 1;
      device.bindAt = new Date();
      await device.save({ transaction });
      await transaction.commit();
      return success(res, device, `设备已绑定给 ${user.username}`);
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      return fail(res, error.message || '设备绑定失败');
    }
  },

  async unbindDevice(req, res) {
    let transaction = null;
    try {
      transaction = await sequelize.transaction();
      const device = await Device.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!device) {
        await transaction.rollback();
        return fail(res, '设备不存在', 404);
      }

      await DeviceGroupMember.destroy({
        where: { deviceId: device.id },
        transaction,
      });
      device.userId = null;
      device.status = 0;
      device.online = 0;
      device.bindAt = null;
      await device.save({ transaction });
      await transaction.commit();
      return success(res, device, '设备解绑成功');
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      return fail(res, error.message || '设备解绑失败');
    }
  },
};
