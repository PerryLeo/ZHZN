import sequelize from '../config/database.js';
import { initUserModel, User } from './user.model.js';
import { initDeviceModel, Device } from './device.model.js';

// 初始化所有模型
initUserModel(sequelize);
initDeviceModel(sequelize);

// 关联关系
User.hasMany(Device, { foreignKey: 'userId', as: 'devices' });
Device.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

// 同步数据库 (开发环境自动建表)
export const syncDB = async () => {
  // force: true 会删表重建 — 生产环境务必设为 false
  await sequelize.sync({ force: false, alter: false });
  console.log('✅ 数据库表已同步');
};

export { User, Device };
