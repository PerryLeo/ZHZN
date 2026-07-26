import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * JWT 认证中间件 — 校验请求头 Authorization: Bearer <token>
 */
export const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 401,
      message: '未登录或 Token 缺失',
      data: null,
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;   // { id, username, email }
    next();
  } catch (err) {
    return res.status(401).json({
      code: 401,
      message: 'Token 无效或已过期',
      data: null,
    });
  }
};
