import { DataTypes } from 'sequelize';

export let User = null;

export const initUserModel = (sequelize) => {
  User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: '用户名 (登录账号)',
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: '密码 (bcrypt 加密)',
    },
    role: {
      type: DataTypes.STRING(20),
      defaultValue: 'user',
      comment: '角色: user | admin',
    },
    tokenVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Token 版本号，修改/重置密码后递增以使旧 Token 立即失效',
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: false,
  });

  return User;
};
