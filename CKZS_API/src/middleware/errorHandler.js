/**
 * 全局错误处理中间件
 */

// 404 处理
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    code: 404,
    message: `接口不存在: ${req.method} ${req.originalUrl}`,
    data: null,
  });
};

// 全局异常捕获
export const errorHandler = (err, req, res, next) => {
  console.error('❌ 服务器错误:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    code: statusCode,
    message,
    data: null,
  });
};
