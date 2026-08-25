import sequelize from '../config/database.js';
import { DataTypes } from 'sequelize';
import { initUserModel, User } from './user.model.js';
import { initDeviceModel, Device } from './device.model.js';
import {
  initDeviceGroupModels,
  DeviceGroup,
  DeviceGroupMember,
} from './deviceGroup.model.js';

// 初始化所有模型
initUserModel(sequelize);
initDeviceModel(sequelize);
initDeviceGroupModels(sequelize);

// 关联关系
User.hasMany(Device, { foreignKey: 'userId', as: 'devices' });
Device.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
User.hasMany(DeviceGroup, { foreignKey: 'userId', as: 'deviceGroups' });
DeviceGroup.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
DeviceGroup.belongsToMany(Device, {
  through: DeviceGroupMember,
  foreignKey: 'groupId',
  otherKey: 'deviceId',
  as: 'devices',
  onDelete: 'CASCADE',
});
Device.belongsToMany(DeviceGroup, {
  through: DeviceGroupMember,
  foreignKey: 'deviceId',
  otherKey: 'groupId',
  as: 'groups',
  onDelete: 'CASCADE',
});

// 同步数据库 (开发环境自动建表)
export const syncDB = async () => {
  // force: true 会删表重建 — 生产环境务必设为 false
  await sequelize.sync({ force: false, alter: false });
  const queryInterface = sequelize.getQueryInterface();
  const deviceColumns = await queryInterface.describeTable('devices');
  if (!deviceColumns.remarkName) {
    await queryInterface.addColumn('devices', 'remarkName', {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '用户备注名称（可修改）',
    });
  }
  const deviceIndexes = await queryInterface.showIndex('devices');
  if (!deviceIndexes.some(index => index.name === 'uniq_devices_initial_name')) {
    await queryInterface.addIndex('devices', ['deviceName'], {
      unique: true,
      name: 'uniq_devices_initial_name',
    });
  }
  console.log('✅ 数据库表已同步');
};

export { User, Device, DeviceGroup, DeviceGroupMember };
