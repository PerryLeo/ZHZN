const batteryAlarmMap = { 1: '满', 2: '过流', 3: '拔出', 4: '过压', 5: '欠流', 6: '电池电压过低' };
const fanAlarmMap = { 1: '风扇1低于阈值', 2: '风扇2低于阈值', 3: '两个风扇均低于阈值', 5: '风扇异常' };

// 蓝牙回执逐行到达，需要保留同一份回执中已收到的报警字段。
export const parseDeviceAlarms = (payload, current = {}) => {
    const text = String(payload || '');
    const batteryMatch = text.match(/(?:^|[|\r\n])\s*BatAlarm:\s*(-?\d+)(?=\s*(?:[|\r\n]|$))/i);
    const fanMatch = text.match(/(?:^|[|\r\n])\s*FanAlarm:\s*(-?\d+)(?=\s*(?:[|\r\n]|$))/i);
    const batteryAlarm = batteryMatch ? Number(batteryMatch[1]) : (current.batteryAlarm ?? null);
    const fanAlarm = fanMatch ? Number(fanMatch[1]) : (current.fanAlarm ?? null);
    const alarms = [];
    if (batteryAlarm !== null && batteryAlarm !== 0) alarms.push(batteryAlarmMap[batteryAlarm] || `电池告警(${batteryAlarm})`);
    if (fanAlarm !== null && fanAlarm !== 0) alarms.push(fanAlarmMap[fanAlarm] || `风扇告警(${fanAlarm})`);
    return {
        batteryAlarm,
        fanAlarm,
        abnormalStatus: alarms.length ? alarms.join('；') : (batteryAlarm === null || fanAlarm === null ? '--' : '无异常'),
        hasAlarm: alarms.length > 0,
    };
};
