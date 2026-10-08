import { DataTypes } from 'sequelize';

export let OtaBatch = null;
export let OtaTask = null;

export const initOtaModels = (sequelize) => {
  OtaBatch = sequelize.define('OtaBatch', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    operatorId: { type: DataTypes.INTEGER, allowNull: false },
    operatorName: { type: DataTypes.STRING(50), allowNull: true },
    scope: { type: DataTypes.STRING(20), allowNull: false },
    targetUserId: { type: DataTypes.INTEGER, allowNull: true },
    targetUserName: { type: DataTypes.STRING(50), allowNull: true },
    firmwareFile: { type: DataTypes.STRING(255), allowNull: false },
    firmwareVersion: { type: DataTypes.STRING(100), allowNull: true },
    firmwareSize: { type: DataTypes.BIGINT, allowNull: false },
    firmwareSha256: { type: DataTypes.STRING(64), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'queued' },
    isPaused: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    targetCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    eligibleCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    skippedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    successCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    failedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'ota_batches',
    timestamps: true,
    indexes: [{ fields: ['createdAt'] }, { fields: ['status'] }],
  });

  OtaTask = sequelize.define('OtaTask', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    batchId: { type: DataTypes.UUID, allowNull: true },
    operatorId: { type: DataTypes.INTEGER, allowNull: false },
    deviceCode: { type: DataTypes.STRING(100), allowNull: false },
    ownerId: { type: DataTypes.INTEGER, allowNull: true },
    ownerName: { type: DataTypes.STRING(50), allowNull: true },
    firmwareFile: { type: DataTypes.STRING(255), allowNull: false },
    firmwareVersion: { type: DataTypes.STRING(100), allowNull: true },
    firmwareSize: { type: DataTypes.BIGINT, allowNull: false },
    firmwareSha256: { type: DataTypes.STRING(64), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
    progress: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    offset: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    message: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '等待升级' },
    retryCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    finishedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'ota_tasks',
    timestamps: true,
    indexes: [
      { fields: ['batchId'] },
      { fields: ['deviceCode', 'createdAt'] },
      { fields: ['status'] },
    ],
  });

  OtaBatch.hasMany(OtaTask, { foreignKey: 'batchId', as: 'tasks', onDelete: 'CASCADE' });
  OtaTask.belongsTo(OtaBatch, { foreignKey: 'batchId', as: 'batch' });
  return { OtaBatch, OtaTask };
};
