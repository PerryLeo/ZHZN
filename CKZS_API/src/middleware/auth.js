import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { User } from '../models/index.js';

/**
 * JWT 认证中间件 — 校验请求头 Authorization: Bearer <token>
 * 同时核对数据库中的 tokenVersion 与 username，确保改密/重置密码/改名后旧 Token 立即失效。
 */
export const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未登录或 Token 缺失',
      data: null,
    });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    return res.status(401).json({
      code: 401,
      message: 'Token 无效或已过期',
      data: null,
    });
  }

  try {
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'role', 'tokenVersion'],
    });
    if (!user) {
      return res.status(401).json({
        code: 401,
        message: '账号不存在或登录已失效',
        data: null,
      });
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    const currentVersion = user.tokenVersion ?? 0;
    const usernameChanged = Boolean(decoded.username && user.username && decoded.username !== user.username);
    if (tokenVersion !== currentVersion || usernameChanged) {
      return res.status(401).json({
        code: 401,
        message: '密码或账号信息已变更，请重新登录',
        data: null,
      });
    }

    req.user = {
      ...decoded,
      id: user.id,
      username: user.username ?? decoded.username,
      role: user.role ?? decoded.role,
    };
    next();
  } catch (err) {
    next(err);
  }
};
