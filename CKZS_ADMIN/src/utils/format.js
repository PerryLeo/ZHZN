export const formatTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replaceAll('/', '-');
};

export const typeLabel = (type) => ({
  dtu: 'DTU',
  sensor: '传感器',
  gateway: '网关',
  camera: '摄像头',
  controller: '控制器',
}[type] || type || '未知类型');
