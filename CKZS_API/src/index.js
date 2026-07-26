import app from './app.js';
import config from './config/index.js';
import { connectDB } from './config/database.js';
import { syncDB } from './models/index.js';

const { port, nodeEnv } = config;

const start = async () => {
  // 连接数据库
  await connectDB();

  // 同步表结构 (开发环境)
  await syncDB();


  // 初始化 MQTT 服务（4G 模块通信）
  try {
    const { default: mqttService } = await import('./services/mqtt.service.js');
    await mqttService.connect();
    console.log('🔌 MQTT 服务已启动');
    mqttService.on('data', async ({ deviceCode, payload }) => {
      console.log('📥 [数据上报] '+deviceCode+':', JSON.stringify(payload));
    });
  } catch (err) {
    console.error('⚠️ MQTT 启动失败（不影响 HTTP）:', err.message);
  }

  // 启动服务
  app.listen(port, () => {
    console.log(`🚀 服务已启动 → http://localhost:${port}`);
    console.log(`📦 环境: ${nodeEnv}`);
  });
};

start();
