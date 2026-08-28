/**
 * 异常状态与在线状态独立：异常设备只要在线，仍可进入详情并下发指令。
 */
export const getDeviceStatus = (device = {}) => {
  if (device.onlineChecking) {
    return { key: 'checking', label: '正在检测', tone: 'checking', isOnline: false };
  }
  if (Number(device.online) !== 1) {
    return { key: 'offline', label: '离线', tone: 'danger', isOnline: false };
  }
  if (Number(device.identityAbnormal) === 1 || device.identityMismatch === true) {
    return { key: 'identity-abnormal', label: '身份异常', tone: 'danger', isOnline: true };
  }
  return { key: 'online', label: '在线', tone: 'success', isOnline: true };
};

export const getOnlineStatus = (device = {}) => {
  if (device.onlineChecking) {
    return { key: 'checking', label: '正在检测', tone: 'checking', isOnline: false };
  }
  if (Number(device.online) === 1) {
    return { key: 'online', label: '在线', tone: 'success', isOnline: true };
  }
  return { key: 'offline', label: '离线', tone: 'danger', isOnline: false };
};

export const getIdentityStatus = (device = {}) => {
  if (device.onlineChecking) {
    return { key: 'checking', label: '正在检测', tone: 'checking' };
  }
  if (Number(device.online) !== 1) {
    return { key: 'unknown', label: '--', tone: 'neutral' };
  }
  if (Number(device.identityAbnormal) === 1 || device.identityMismatch === true) {
    return { key: 'abnormal', label: '身份异常', tone: 'danger' };
  }
  return { key: 'normal', label: '身份正常', tone: 'success' };
};

export const getCombinedStatus = (device = {}) => {
  const onlineStatus = getOnlineStatus(device);
  if (!onlineStatus.isOnline) return [onlineStatus];
  return [onlineStatus, getIdentityStatus(device)];
};
