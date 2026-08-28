export const createDeviceState = () => ({
  currentTrip: 0,
  nearWaitTime: 0,
  farWaitTime: 0,
  manualTripsVal: 0,
  runMode: '未知',
  feedTimeout: 0,
  feedTime: 0,
  softLimit: 0,
  feedSpeed: 0,
  motorTorque: 0,
  moveSpeed: 0,
  chargingTargetVoltage: 0,
  chargingCurrentLimit: 0,
  startMinimumVoltage: 0,
  autoShutdownTime: 0,
  deviceStatus: '等待设备响应',
  fanStatus: '',
  pumpStatus: '',
  version: '',
  deviceTime: '--:--:--',
  batteryLevel: null,
  chargingCurrent: null,
  abnormalStatus: '--',
  hasAlarm: false,
  controlState: 'unknown',
  controlStateLabel: '状态未知',
  timeSlots: Array.from({ length: 12 }, () => ({ time: '00:00', trips: 0 })),
});

const getStatusMetric = (text, fields) => {
  const match = String(text || '').match(new RegExp(`(?:^|[|\\r\\n])(?:${fields.join('|')})\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'));
  return match ? Number(match[1]) : null;
};

export const getCsqSignalLevel = (value) => {
  const csq = Number(value);
  if (!Number.isFinite(csq) || csq < 0 || csq > 31) return 0;
  if (csq >= 24) return 3;
  if (csq >= 17) return 2;
  if (csq >= 13) return 1;
  return 0;
};

export const parseControlState = (rawState) => {
  const value = String(rawState || '').trim();
  const matched = value.match(/^(Unreturn|Pause|Wait|Waiting|Running|Return|Returning|Idle|A-B|B-A)(?=$|[\s(:])/i);
  const keyword = matched ? matched[1].toLowerCase() : '';
  if (keyword === 'pause') return { controlState: 'paused', controlStateLabel: '暂停' };
  if (keyword === 'wait' || keyword === 'waiting' || keyword === 'running' || keyword === 'a-b' || keyword === 'b-a') {
    return { controlState: 'running', controlStateLabel: keyword === 'wait' || keyword === 'waiting' ? '等待中' : '运行中' };
  }
  if (keyword === 'idle' || keyword === 'unreturn') return { controlState: 'idle', controlStateLabel: '空闲' };
  if (keyword === 'return' || keyword === 'returning') return { controlState: 'returning', controlStateLabel: '归位中' };
  return { controlState: 'unknown', controlStateLabel: '状态未知' };
};

export const parseDeviceStatusReport = (payload) => {
  const text = extractResponseText(payload);
  const carMatch = text.match(/(?:^|[|\r\n])\s*Car\s*:\s*([^|\r\n]+)/i);
  const batteryAlarm = getStatusMetric(text, ['BatAlarm']);
  const fanAlarm = getStatusMetric(text, ['FanAlarm']);
  const batteryAlarmMap = { 1: '满', 2: '过流', 3: '拔出', 4: '过压', 5: '欠流', 6: '电池电压过低' };
  const fanAlarmMap = { 1: '风扇1低于阈值', 2: '风扇2低于阈值', 3: '两个风扇均低于阈值', 5: '启动瞬间电流不足' };
  const alarms = [];
  if (batteryAlarm !== null && batteryAlarm !== 0) alarms.push(batteryAlarmMap[batteryAlarm] || `电池告警(${batteryAlarm})`);
  if (fanAlarm !== null && fanAlarm !== 0) alarms.push(fanAlarmMap[fanAlarm] || `风扇告警(${fanAlarm})`);
  return {
    batteryLevel: getStatusMetric(text, ['BatLevel']),
    chargingCurrent: getStatusMetric(text, ['I_Chg']),
    signalStrength: getStatusMetric(text, ['CSQ']),
    ...(carMatch ? parseControlState(carMatch[1]) : {}),
    abnormalStatus: batteryAlarm === null || fanAlarm === null ? '--' : (alarms.length ? alarms.join('；') : '无异常'),
    hasAlarm: alarms.length > 0,
  };
};

export const extractResponseText = (payload) => {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) return payload.map(extractResponseText).filter(Boolean).join('\n');
  if (typeof payload === 'object') {
    if (payload.data !== undefined) return extractResponseText(payload.data);
    if (payload.payload !== undefined) return extractResponseText(payload.payload);
    if (payload.rawData !== undefined) return extractResponseText(payload.rawData);
  }
  return String(payload);
};

const formatDeviceStatus = (status) => {
  const value = String(status || '').trim();
  const waitingMatch = value.match(/^Waiting:\s*(\d+)\s*s?$/i);
  if (waitingMatch) return `等待中，剩余${waitingMatch[1]}秒`;

  const runningMatch = value.match(/^Running:\s*(B-A|A-B)(?:\s|$)/i);
  if (runningMatch) return runningMatch[1].toUpperCase() === 'B-A' ? '正在从B往A运动' : '正在从A往B运动';

  const statusMap = {
    Unreturn: '刚上电，未归位',
    Pause: '暂停',
    Idle: '空闲',
    running: '运行中',
  };
  return statusMap[value] || value || '未知';
};

export const parseDeviceResponse = (payload, currentState = createDeviceState()) => {
  const nextState = {
    ...currentState,
    timeSlots: currentState.timeSlots.map(item => ({ ...item })),
  };
  const text = extractResponseText(payload);
  if (!text) return { state: nextState, text };

  const statusMatch = text.match(/<([^>]+)>/);
  if (statusMatch) {
    const parts = statusMatch[1].split('|');
    nextState.deviceStatus = formatDeviceStatus(parts[0]);
    Object.assign(nextState, parseControlState(parts[0]));
    parts.forEach((part) => {
      if (part.includes('Fan:')) nextState.fanStatus = part.split(':')[1];
      if (part.includes('Pump:')) nextState.pumpStatus = part.split(':')[1];
      if (part.includes('Times:')) nextState.currentTrip = Number.parseInt(part.split(':')[1], 10) || 0;
    });
  }

  const timeMatch = text.match(/(?:^|[|\r\n])Time:\s*([^|\r\n]+)/i);
  if (timeMatch) nextState.deviceTime = timeMatch[1].trim();

  const versionMatch = text.match(/(?:^|[|\r\n])Ver:\s*([^|\r\n]+)/i);
  if (versionMatch) nextState.version = versionMatch[1].trim();

  Object.assign(nextState, parseDeviceStatusReport(text));

  const modeMap = { 0: '自动', 1: '手动', 2: '撒药' };
  const fieldMap = {
    1: 'nearWaitTime',
    2: 'farWaitTime',
    3: 'manualTripsVal',
    5: 'feedTimeout',
    6: 'feedTime',
    7: 'softLimit',
    8: 'feedSpeed',
    9: 'motorTorque',
    a: 'moveSpeed',
    d: 'chargingTargetVoltage',
    e: 'chargingCurrentLimit',
    f: 'startMinimumVoltage',
    g: 'autoShutdownTime',
  };
  const valuePattern = /\$([0-9ad-g])=(-?\d+(?:\.\d+)?)/g;
  let valueMatch = null;
  while ((valueMatch = valuePattern.exec(text)) !== null) {
    const key = valueMatch[1];
    const value = Number(valueMatch[2]);
    if (key === '4') nextState.runMode = modeMap[value] || '未知';
    else if (fieldMap[key]) nextState[fieldMap[key]] = value;
  }

  const slotPattern = /\$([H-S])=(\d{6})/g;
  let slotMatch = null;
  while ((slotMatch = slotPattern.exec(text)) !== null) {
    const raw = slotMatch[2];
    const index = slotMatch[1].charCodeAt(0) - 'H'.charCodeAt(0);
    nextState.timeSlots[index] = {
      time: `${raw.slice(2, 4)}:${raw.slice(4, 6)}`,
      trips: Number.parseInt(raw.slice(0, 2), 10) || 0,
    };
  }

  return { state: nextState, text };
};

export const getTimeCommand = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `$T=${hours}${minutes}`;
};

export const createSlotCommand = (slot, index) => {
  const mode = 'HIJKLMNOPQRS'[index];
  const trips = Math.min(Math.max(Number.parseInt(slot.trips, 10) || 0, 0), 99);
  const time = /^\d{2}:\d{2}$/.test(slot.time) ? slot.time.replace(':', '') : '0000';
  return `$${mode}=${String(trips).padStart(2, '0')}${time}`;
};
