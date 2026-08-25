import { DataTypes } from 'sequelize';

export let Device = null;

export const initDeviceModel = (sequelize) => {
  Device = sequelize.define('Device', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    deviceCode: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: '设备唯一编码 (SN/IMEI等)',
    },
    deviceName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '设备初始名称（与 IMEI 一一对应，不可修改）',
    },
    remarkName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '用户备注名称（可修改）',
    },
    deviceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '设备类型: sensor/gateway/camera 等',
    },
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      comment: '绑定状态: 0-未绑定 1-已绑定',
    },
    online: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      comment: '在线状态: 0-离线 1-在线',
    },
    bindAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '绑定时间',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '绑定的用户 ID (FK)',
    },
  }, {
    tableName: 'devices',
    timestamps: true,
    underscored: false,
    indexes: [
      { unique: true, fields: ['deviceName'], name: 'uniq_devices_initial_name' },
    ],
  });

  return Device;
};
