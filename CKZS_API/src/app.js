import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// -------------------- 全局中间件 --------------------
app.use(cors());                                     // 跨域
app.use(morgan('dev'));                              // 请求日志
app.use(express.json());                             // 解析 JSON body
app.use(express.urlencoded({ extended: true }));     // 解析 URL-encoded body

// -------------------- 路由 --------------------
app.use('/api', routes);

// -------------------- 健康检查 --------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// -------------------- 错误处理 --------------------
app.use(notFoundHandler);   // 404
app.use(errorHandler);      // 全局异常

export default app;
