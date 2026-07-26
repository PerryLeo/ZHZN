/**
 * 统一响应格式
 */

export const success = (res, data = null, message = 'ok', statusCode = 200) => {
  return res.status(statusCode).json({
    code: 0,
    message,
    data,
  });
};

export const fail = (res, message = '请求失败', statusCode = 400, code = -1) => {
  return res.status(statusCode).json({
    code,
    message,
    data: null,
  });
};

export const paginate = (res, { list, total, page, pageSize }) => {
  return res.status(200).json({
    code: 0,
    message: 'ok',
    data: {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
};
