import { Sequelize } from 'sequelize';
import config from './index.js';

const { db } = config;

const sequelize = new Sequelize(db.database, db.user, db.password, {
  host: db.host,
  port: db.port,
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? (msg) => console.log(`📝 ${msg}`) : false,
  // 连接池
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// 测试连接
export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  }
};

export default sequelize;
