import { DataTypes } from 'sequelize';

export let DeviceGroup = null;
export let DeviceGroupMember = null;

export const initDeviceGroupModels = (sequelize) => {
  DeviceGroup = sequelize.define('DeviceGroup', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '设备分组名称',
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '分组所属用户 ID',
    },
  }, {
    tableName: 'device_groups',
    timestamps: true,
    underscored: false,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'name'],
        name: 'uniq_device_group_user_name',
      },
    ],
  });

  DeviceGroupMember = sequelize.define('DeviceGroupMember', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '设备分组 ID',
    },
    deviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '设备 ID',
    },
  }, {
    tableName: 'device_group_members',
    timestamps: true,
    underscored: false,
    indexes: [
      {
        unique: true,
        fields: ['groupId', 'deviceId'],
        name: 'uniq_device_group_member',
      },
    ],
  });

  return { DeviceGroup, DeviceGroupMember };
};
