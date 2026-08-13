import { User } from '../models/index.js';
import { fail } from '../utils/response.js';

/**
 * PC 管理端管理员鉴权。
 * 必须放在 auth 后使用，并实时读取数据库角色，避免仅信任 Token 内的旧权限。
 */
export const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'role'],
    });

    if (!user || user.role !== 'admin') {
      return fail(res, '仅管理员可访问', 403);
    }

    req.admin = user;
    next();
  } catch (error) {
    next(error);
  }
};
