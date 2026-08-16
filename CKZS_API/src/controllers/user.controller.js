import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { User, Device, DeviceGroup, DeviceGroupMember } from '../models/index.js';
import config from '../config/index.js';
import { success, fail, paginate } from '../utils/response.js';

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

const userInfo = (user) => {
  const obj = user.toJSON ? user.toJSON() : user;
  const { password, ...info } = obj;
  return info;
};

export const UserController = {
  // ==================== 注册 ====================
  async register(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return fail(res, '请输入账号和密码');
      }
      if (password.length < 6) {
        return fail(res, '密码长度不能少于6位');
      }
      const exist = await User.findOne({ where: { username } });
      if (exist) return fail(res, '账号已被注册');

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ username, password: hashedPassword });

      return success(res, { user: userInfo(user), token: generateToken(user) }, '注册成功', 201);
    } catch (err) {
      return fail(res, err.message || '注册失败');
    }
  },

  // ==================== 登录 ====================
  async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) return fail(res, '请输入账号和密码');

      const user = await User.findOne({ where: { username } });
      if (!user) return fail(res, '账号或密码错误');

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return fail(res, '账号或密码错误');

      return success(res, { user: userInfo(user), token: generateToken(user) }, '登录成功');
    } catch (err) {
      return fail(res, err.message || '登录失败');
    }
  },

  // ==================== 当前用户信息 ====================
  async profile(req, res) {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] },
      });
      if (!user) return fail(res, '用户不存在', 404);
      return success(res, user);
    } catch (err) {
      return fail(res, err.message);
    }
  },

  // ==================== 修改密码 ====================
  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) return fail(res, '请输入旧密码和新密码');
      if (newPassword.length < 6) return fail(res, '新密码长度不能少于6位');

      const user = await User.findByPk(req.user.id);
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) return fail(res, '旧密码错误');

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      return success(res, null, '密码修改成功');
    } catch (err) {
      return fail(res, err.message || '修改失败');
    }
  },

  // ==================== 绑定设备 ====================
  async bindDevice(req, res) {
    try {
      const { deviceCode } = req.body;
      if (!deviceCode) return fail(res, '缺少必填参数: deviceCode');

      // 设备不存在则自动注册（用户通过蓝牙获取 IMEI，物理接触即视为合法）
      const [device] = await Device.findOrCreate({
        where: { deviceCode },
        defaults: { deviceName: deviceCode, deviceType: 'dtu', status: 0, online: 0 },
      });

      // 已被别人绑定（userId 非空且不是当前用户）
      if (device.userId && device.userId !== req.user.id) {
        return fail(res, '设备已被其他用户绑定');
      }
      // 已被当前用户绑定（幂等）
      if (device.userId === req.user.id) {
        return success(res, device, '设备已绑定到当前用户');
      }

      // 未绑定 → 执行绑定
      device.userId = req.user.id;
      device.status = 1;
      device.online = 1;
      device.bindAt = new Date();
      await device.save();

      return success(res, device, '设备绑定成功');
    } catch (err) {
      return fail(res, err.message || '绑定失败');
    }
  },

  // ==================== 我的设备列表 ====================
  async myDeviceSummary(req, res) {
    try {
      const where = { userId: req.user.id, status: 1 };
      const [total, online] = await Promise.all([
        Device.count({ where }),
        Device.count({ where: { ...where, online: 1 } }),
      ]);

      return success(res, {
        total,
        online,
        offline: total - online,
      });
    } catch (err) {
      return fail(res, err.message || '设备汇总获取失败');
    }
  },

  async myDevices(req, res) {
    try {
      const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
      const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || 10, 1), 100);
      const groupId = Number.parseInt(req.query.groupId, 10);
      const where = { userId: req.user.id, status: 1 };

      if (Number.isInteger(groupId) && groupId > 0) {
        const group = await DeviceGroup.findOne({
          where: { id: groupId, userId: req.user.id },
          attributes: ['id'],
        });
        if (!group) return fail(res, '设备分组不存在或不属于当前用户', 404);

        const members = await DeviceGroupMember.findAll({
          where: { groupId },
          attributes: ['deviceId'],
        });
        where.id = { [Op.in]: members.map(member => member.deviceId) };
      }

      const { count, rows } = await Device.findAndCountAll({
        where,
        order: [['bindAt', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return paginate(res, { list: rows, total: count, page, pageSize });
    } catch (err) {
      return fail(res, err.message);
    }
  },

  // ==================== 修改已绑定设备名称 ====================
  async updateDeviceName(req, res) {
    try {
      const { deviceCode, deviceName } = req.body;
      const name = String(deviceName || '').trim();

      if (!deviceCode) return fail(res, '缺少必填参数: deviceCode');
      if (!name) return fail(res, '设备名称不能为空');
      if (name.length > 100) return fail(res, '设备名称不能超过 100 个字符');

      const device = await Device.findOne({
        where: { deviceCode, userId: req.user.id, status: 1 },
      });
      if (!device) return fail(res, '设备不存在或不属于当前用户', 404);

      device.deviceName = name;
      await device.save();

      return success(res, device, '设备名称修改成功');
    } catch (err) {
      return fail(res, err.message || '设备名称修改失败');
    }
  },

  // ==================== 重置密码（管理员）====================
  async resetPassword(req, res) {
    try {
      const admin = await User.findByPk(req.user.id);
      if (!admin || admin.role !== 'admin') return fail(res, '无权限', 403);

      const { username } = req.body;
      if (!username) return fail(res, '缺少 username');

      const user = await User.findOne({ where: { username } });
      if (!user) return fail(res, '用户不存在', 404);

      const defaultPwd = '123456';
      user.password = await bcrypt.hash(defaultPwd, 10);
      await user.save();

      return success(res, null, `已重置 ${username} 的密码为 ${defaultPwd}`);
    } catch (err) {
      return fail(res, err.message || '重置失败');
    }
  },

  // ==================== 解绑设备 ====================
  async unbindDevice(req, res) {
    let transaction = null;
    try {
      const { deviceCode } = req.body;
      if (!deviceCode) return fail(res, '缺少必填参数: deviceCode');

      transaction = await sequelize.transaction();
      const device = await Device.findOne({
        where: { deviceCode, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!device) {
        await transaction.rollback();
        return fail(res, '设备不存在或不属于当前用户', 404);
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
    } catch (err) {
      if (transaction && !transaction.finished) await transaction.rollback();
      return fail(res, err.message || '解绑失败');
    }
  },
};
