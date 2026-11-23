export const getDeviceStatus = (device = {}) => {
  if (device.onlineChecking) {
    return { key: 'checking', label: '正在检测', tone: 'checking', isOnline: false };
  }
  if (Number(device.online) !== 1) {
    return { key: 'offline', label: '离线', tone: 'danger', isOnline: false };
  }
  return { key: 'online', label: '在线', tone: 'success', isOnline: true };
};
