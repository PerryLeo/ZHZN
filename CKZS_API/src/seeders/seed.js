import bcrypt from 'bcryptjs';
import sequelize from '../config/database.js';
import { User, Device } from '../models/index.js';

const users = [
  { username: 'admin',  password: 'admin123', role: 'admin' },
  { username: 'zhangsan', password: '123456' },
  { username: 'lisi',    password: '123456' },
  { username: 'wangwu',  password: '123456' },
  { username: 'zhaoliu', password: '123456' },
  { username: 'test',    password: 'test123' },
  { username: 'dev01',   password: 'dev123' },
  { username: 'dev02',   password: 'dev123' },
];

const devices = [
  { deviceCode: 'DEV-2024-001', deviceName: '厂房A温湿度传感器', deviceType: 'sensor' },
  { deviceCode: 'DEV-2024-002', deviceName: '厂房B压力传感器',   deviceType: 'sensor' },
  { deviceCode: 'DEV-2024-003', deviceName: '1号生产线PLC',      deviceType: 'gateway' },
  { deviceCode: 'DEV-2024-004', deviceName: '2号生产线PLC',      deviceType: 'gateway' },
  { deviceCode: 'DEV-2024-005', deviceName: '仓库监控摄像头',    deviceType: 'camera' },
  { deviceCode: 'DEV-2024-006', deviceName: '办公楼门禁控制器',  deviceType: 'controller' },
  { deviceCode: 'DEV-2024-007', deviceName: '冷却塔振动传感器',  deviceType: 'sensor' },
  { deviceCode: 'DEV-2024-008', deviceName: '锅炉温度传感器',    deviceType: 'sensor' },
];

const seed = async () => {
  try {
    // 重建表
    await sequelize.sync({ force: true });
    console.log('🔄 表已重建\n');

    // ---- 用户 ----
    console.log('👤 创建用户...');
    for (const u of users) {
      const hashed = await bcrypt.hash(u.password, 10);
      await User.create({ ...u, password: hashed });
      console.log(`✅ ${u.username}  |  🔑 ${u.password}`);
    }

    // ---- 设备 ----
    console.log('\n📱 创建设备...');
    for (const d of devices) {
      await Device.create(d);
      console.log(`✅ ${d.deviceCode} → ${d.deviceName}`);
    }

    console.log('\n🎉 假数据填充完成！');
  } catch (err) {
    console.error('❌ 种子数据失败:', err.message);
  } finally {
    await sequelize.close();
  }
};

seed();
