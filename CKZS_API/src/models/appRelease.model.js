import { DataTypes } from 'sequelize';

export let AppRelease = null;
export const initAppReleaseModel = sequelize => {
  AppRelease = sequelize.define('AppRelease', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    packageName: { type: DataTypes.STRING(200), allowNull: false },
    versionName: { type: DataTypes.STRING(100), allowNull: false },
    versionCode: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    minSdkVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    certificateSha256: { type: DataTypes.TEXT, allowNull: false },
    fileName: { type: DataTypes.STRING(100), allowNull: false },
    fileSize: { type: DataTypes.BIGINT, allowNull: false },
    sha256: { type: DataTypes.STRING(64), allowNull: false },
    forceUpdate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    operatorId: { type: DataTypes.INTEGER, allowNull: false },
    operatorName: { type: DataTypes.STRING(50), allowNull: true },
    publishedAt: { type: DataTypes.DATE, allowNull: true },
  }, { tableName: 'app_releases', timestamps: true, indexes: [{ fields: ['status'] }] });
  return AppRelease;
};
