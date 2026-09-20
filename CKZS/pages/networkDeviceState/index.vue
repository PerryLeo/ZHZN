<template>
    <view class="page-wrapper">
        <view class="bg-layer"></view>
        <view class="container">
            <view class="header">
                <view class="back-btn" @click="goBack">
                    <text class="arrow iconfont icon-arrow-left"></text>
                </view>
                <text class="page-title">{{ pageTitle }}</text>
                <view class="refresh-btn" @click="handleRefresh">刷新</view>
            </view>

            <view class="status-card">
                <view class="status-summary">
                    <text class="status-label">当前状态</text>
                    <view class="status-main">
                        <text class="status-value">{{ state.deviceStatus || '未知' }}</text>
                        <view
                            class="device-control-button"
                            :class="{ disabled: state.controlLoading || state.controlState === 'unknown' || state.controlState === 'returning' }"
                            @click="handleDeviceControl"
                        >
                            <text>{{ getDeviceControlLabel() }}</text>
                        </view>
                    </view>
                </view>
                <view class="status-divider"></view>
                <view class="trip-progress">
                    <view class="trip-meta">
                        <text class="device-time">{{ state.deviceTime }}</text>
                        <view class="trip-count">
                            <text class="current">{{ state.currentTrip }}</text>
                            <text class="sep">/</text>
                            <text class="total">{{ state.manualTripsVal }}</text>
                            <text class="unit">趟</text>
                        </view>
                    </view>
                    <view class="progress-track">
                        <view class="progress-value" :style="{ width: `${percentage}%` }"></view>
                    </view>
                </view>
                <view class="status-divider"></view>
                <view class="status-health">
                    <view class="health-item" :class="state.identityMismatch ? 'status-abnormal' : 'status-normal'">
                        <text class="health-icon">{{ state.identityMismatch ? '!' : '✓' }}</text>
                        <text>{{ state.identityMismatch ? '身份异常' : '身份正常' }}</text>
                    </view>
                    <view class="health-item" :class="state.hasAlarm ? 'status-abnormal' : (state.abnormalStatus === '无异常' ? 'status-normal' : 'status-muted')">
                        <text class="health-icon">{{ state.hasAlarm ? '!' : (state.abnormalStatus === '--' ? '−' : '✓') }}</text>
                        <text>{{ state.abnormalStatus }}</text>
                    </view>
                </view>
            </view>

            <view class="realtime-card">
                <view class="realtime-metric">
                    <text class="realtime-label">充电器电压</text>
                    <view class="realtime-value-box">
                        <text class="realtime-value">{{ formatRealtimeValue(state.chargerVoltage) }}</text>
                        <text v-if="state.chargerVoltage !== null" class="realtime-unit">V</text>
                    </view>
                </view>
                <view class="realtime-divider"></view>
                <view class="realtime-metric">
                    <text class="realtime-label">电池电压</text>
                    <view class="realtime-value-box">
                        <text class="realtime-value">{{ formatRealtimeValue(state.batteryVoltage) }}</text>
                        <text v-if="state.batteryVoltage !== null" class="realtime-unit">V</text>
                    </view>
                </view>
                <view class="realtime-divider"></view>
                <view class="realtime-metric">
                    <text class="realtime-label">电量</text>
                    <view class="realtime-value-box">
                        <text class="realtime-value">{{ formatRealtimeValue(state.batteryLevel) }}</text>
                        <text v-if="state.batteryLevel !== null" class="realtime-unit">%</text>
                    </view>
                </view>
                <view class="realtime-divider"></view>
                <view class="realtime-metric">
                    <text class="realtime-label">充电电流</text>
                    <view class="realtime-value-box">
                        <text class="realtime-value">{{ formatRealtimeValue(state.chargingCurrent) }}</text>
                        <text v-if="state.chargingCurrent !== null" class="realtime-unit">A</text>
                    </view>
                </view>
            </view>

            <view class="action-grid">
                <view class="action-card manual-action" @click="handleAction('manual')">
                    <view class="icon-box manual">
                        <text class="iconfont icon-shoudong"></text>
                    </view>
                    <text class="label">手动设置</text>
                </view>
                <view class="action-card auto-action" @click="handleAction('auto')">
                    <view class="icon-box auto">
                        <text class="iconfont icon-zidong"></text>
                    </view>
                    <text class="label">自动设置</text>
                </view>
            </view>

            <view class="parameter-card">
                <view class="parameter-section">
                    <view class="section-heading"><text class="heading-mark"></text><text>运行参数</text></view>
                    <view class="parameter-grid">
                        <view class="parameter-item"><text class="parameter-label">近端等待时间</text><view class="parameter-value"><text>{{ state.nearWaitTime }}</text><text class="unit">s</text></view></view>
                        <view class="parameter-item"><text class="parameter-label">远端等待时间</text><view class="parameter-value"><text>{{ state.farWaitTime }}</text><text class="unit">s</text></view></view>
                        <view class="parameter-item"><text class="parameter-label">手动模式趟数</text><view class="parameter-value"><text>{{ state.manualTripsVal }}</text><text class="unit">趟</text></view></view>
                        <view class="parameter-item"><text class="parameter-label">喂食超时时间</text><view class="parameter-value"><text>{{ state.feedTimeout }}</text><text class="unit">s</text></view></view>
                        <view class="parameter-item">
                            <text class="parameter-label">软限位距离</text>
                            <view class="parameter-value">
                                <text v-if="state.softLimit && state.softLimit > 0">{{ (state.softLimit / 100).toFixed(2) }}</text>
                                <text v-if="state.softLimit && state.softLimit > 0" class="unit">米</text>
                                <text v-else>关闭</text>
                            </view>
                        </view>
                        <view class="parameter-item"><text class="parameter-label">送料电机转速</text><view class="parameter-value"><text>{{ Number.isInteger(state.feedSpeed / 10) ? state.feedSpeed / 10 : (state.feedSpeed / 10).toFixed(1) }}</text><text class="unit">圈/秒</text></view></view>
                        <view class="parameter-item"><text class="parameter-label">送料电机扭矩</text><view class="parameter-value"><text>{{ state.motorTorque }}</text><text class="unit">%</text></view></view>
                        <view class="parameter-item"><text class="parameter-label">移动速度</text><view class="parameter-value"><text>{{ state.moveSpeed }}</text><text class="unit">%</text></view></view>
                    </view>
                </view>

                <view class="parameter-section">
                    <view class="section-heading"><text class="heading-mark"></text><text>充电保护</text></view>
                    <view class="parameter-grid">
                        <view class="parameter-item"><text class="parameter-label">充电目标电压</text><view class="parameter-value"><text>{{ state.chargingTargetVoltage / 100 }}</text><text class="unit">V</text></view></view>
                        <view class="parameter-item"><text class="parameter-label">充电电流预警</text><view class="parameter-value"><text>{{ state.chargingCurrentLimit / 1000 }}</text><text class="unit">A</text></view></view>
                        <view class="parameter-item"><text class="parameter-label">启动最低电压</text><view class="parameter-value"><text>{{ state.startMinimumVoltage / 100 }}</text><text class="unit">V</text></view></view>
                        <view class="parameter-item"><text class="parameter-label">自动关机时间</text><view class="parameter-value"><text>{{ state.autoShutdownTime }}</text><text class="unit">s</text></view></view>
                    </view>
                </view>

                <view class="parameter-section last-section">
                    <view class="section-heading"><text class="heading-mark"></text><text>设备状态</text></view>
                    <view class="parameter-grid">
                        <view class="parameter-item"><text class="parameter-label">运行模式</text><view class="parameter-value highlight"><text>{{ state.runMode }}</text></view></view>
                        <view class="parameter-item"><text class="parameter-label">风扇</text><view class="parameter-value" :class="{ 'highlight': state.fanStatus === 'ON' }"><text>{{ state.fanStatus === 'ON' ? '开启' : '关闭' }}</text></view></view>
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import http from '@/common/request.js';

const state = reactive({
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
    deviceStatus: '',
    fanStatus: '',
    pumpStatus: '',
    version: '',
    deviceTime: '00:00:00',
    batteryLevel: null,
    chargingCurrent: null,
    chargerVoltage: null,
    batteryVoltage: null,
    controlState: 'unknown',
    controlStateLabel: '未知',
    controlLoading: false,
    identityMismatch: false,
    abnormalStatus: '--',
    hasAlarm: false,
    deviceCode: '',
    remarkName: '',
    timeSlots: [],
});

const pageTitle = ref('设备状态详情');
const isRefreshing = ref(false);
let hasLoadedFromDeviceList = false;

const handleDeviceNameUpdated = (payload) => {
    if (payload?.deviceCode === state.deviceCode) {
        state.remarkName = payload.remarkName || '';
        pageTitle.value = state.remarkName || state.deviceCode;
    }
};

onLoad((options) => {
    if (options.from !== 'device-list') {
        uni.showToast({ title: '请从设备列表进入详情', icon: 'none' });
        setTimeout(() => uni.navigateBack(), 300);
        return;
    }
    if (options.name) pageTitle.value = decodeURIComponent(options.name);
    if (options.deviceCode) state.deviceCode = decodeURIComponent(options.deviceCode);
    if (options.remarkName) state.remarkName = decodeURIComponent(options.remarkName);
    state.identityMismatch = options.identityMismatch === '1' || options.identityMismatch === 'true';
    if (options.abnormalStatus !== undefined) state.abnormalStatus = decodeURIComponent(options.abnormalStatus);
    state.hasAlarm = options.hasAlarm === '1' || options.hasAlarm === 'true';
});

onShow(() => {
    if (state.deviceCode && !hasLoadedFromDeviceList) {
        hasLoadedFromDeviceList = true;
        refreshDeviceState({ syncClock: true, showLoading: true });
    }
});

onMounted(() => {
    uni.$on('UPDATE_NETWORK_DEVICE_NAME', handleDeviceNameUpdated);
});

onUnmounted(() => {
    uni.$off('UPDATE_NETWORK_DEVICE_NAME', handleDeviceNameUpdated);
});

const percentage = computed(() => {
    if (!state.manualTripsVal) return 0;
    return Math.min(100, (state.currentTrip / state.manualTripsVal) * 100);
});

const formatRealtimeValue = (value) => value === null || value === undefined ? '--' : value;

const sendNetworkCommand = (data, timeout = 10000) => {
    return http.post('/api/devices/command', {
        deviceCode: state.deviceCode,
        type: 'send',
        params: { data },
        timeout
    }, { timeout: timeout + 2000 });
};

const extractResponseText = (payload) => {
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
        Returning: '归位中',
        running: '运行中'
    };
    return statusMap[value] || value || '未知';
};

const parseControlState = (status) => {
    const value = String(status || '').trim();
    const matched = value.match(/^(Unreturn|Pause|Waiting|Running|Returning|Return|Idle)(?=$|[\s(:])/i);
    const keyword = matched ? matched[1].toLowerCase() : '';
    if (keyword === 'pause') return { state: 'paused', label: '暂停' };
    if (keyword === 'waiting' || keyword === 'running') return { state: 'running', label: keyword === 'waiting' ? '等待中' : '运行中' };
    if (keyword === 'idle' || keyword === 'unreturn') return { state: 'idle', label: '空闲' };
    if (keyword === 'returning' || keyword === 'return') return { state: 'returning', label: '归位中' };
    return { state: 'unknown', label: '未知' };
};

const parseDeviceResponse = (payload) => {
    const text = extractResponseText(payload);
    if (!text) return;

    const statusMatch = text.match(/<([^>]+)>/);
    if (statusMatch) {
        const parts = statusMatch[1].split('|');
        state.deviceStatus = formatDeviceStatus(parts[0]);
        const control = parseControlState(parts[0]);
        state.controlState = control.state;
        state.controlStateLabel = control.label;
        parts.forEach((part) => {
            if (part.includes('Fan:')) state.fanStatus = part.split(':')[1];
            if (part.includes('Pump:')) state.pumpStatus = part.split(':')[1];
            if (part.includes('Times:')) state.currentTrip = parseInt(part.split(':')[1]) || 0;
        });
    }

    const batteryMatch = text.match(/(?:^|[|\r\n])BatLevel:\s*(-?\d+(?:\.\d+)?)\s*%?/i);
    if (batteryMatch) state.batteryLevel = Number(batteryMatch[1]);
    const chargerVoltageMatch = text.match(/(?:^|[|\r\n])V_Chg:\s*(-?\d+(?:\.\d+)?)\s*V?/i);
    if (chargerVoltageMatch) state.chargerVoltage = Number(chargerVoltageMatch[1]);
    const batteryVoltageMatch = text.match(/(?:^|[|\r\n])Bat:\s*(-?\d+(?:\.\d+)?)\s*V?/i);
    if (batteryVoltageMatch) state.batteryVoltage = Number(batteryVoltageMatch[1]);
    const currentMatch = text.match(/(?:^|[|\r\n])I_Chg:\s*(-?\d+(?:\.\d+)?)\s*A?/i);
    if (currentMatch) state.chargingCurrent = Number(currentMatch[1]);

    const timeMatch = text.match(/(?:^|[|\r\n])Time:\s*([^|\r\n]+)/i);
    if (timeMatch) state.deviceTime = timeMatch[1].trim();

    const versionMatch = text.match(/(?:^|[|\r\n])Ver:\s*([^|\r\n]+)/i);
    if (versionMatch) state.version = versionMatch[1].trim();

    const modeMap = { 0: '自动', 1: '手动', 2: '撒药' };
    const valuePattern = /\$([0-9ad-g])=(-?\d+(?:\.\d+)?)/g;
    let valueMatch = null;
    while ((valueMatch = valuePattern.exec(text)) !== null) {
        const key = valueMatch[1];
        const value = Number(valueMatch[2]);
        switch (key) {
            case '1': state.nearWaitTime = value; break;
            case '2': state.farWaitTime = value; break;
            case '3': state.manualTripsVal = value; break;
            case '4': state.runMode = modeMap[value] || '未知'; break;
            case '5': state.feedTimeout = value; break;
            case '6': state.feedTime = value; break;
            case '7': state.softLimit = value; break;
            case '8': state.feedSpeed = value; break;
            case '9': state.motorTorque = value; break;
            case 'a': state.moveSpeed = value; break;
            case 'd': state.chargingTargetVoltage = value; break;
            case 'e': state.chargingCurrentLimit = value; break;
            case 'f': state.startMinimumVoltage = value; break;
            case 'g': state.autoShutdownTime = value; break;
        }
    }

    const slotPattern = /\$([H-S])=(\d{6})/g;
    let slotMatch = null;
    while ((slotMatch = slotPattern.exec(text)) !== null) {
        const raw = slotMatch[2];
        const index = slotMatch[1].charCodeAt(0) - 'H'.charCodeAt(0);
        state.timeSlots[index] = {
            time: `${raw.slice(2, 4)}:${raw.slice(4, 6)}`,
            trips: parseInt(raw.slice(0, 2)) || 0
        };
    }
};

const getTimeCommand = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `$T=${hh}${mm}`;
};

const refreshDeviceState = async ({ syncClock = false, showLoading = false } = {}) => {
    if (!state.deviceCode || isRefreshing.value) return;

    isRefreshing.value = true;
    if (showLoading) uni.showLoading({ title: '正在刷新...', mask: true });

    try {
        if (syncClock) await sendNetworkCommand(getTimeCommand());
        const result = await sendNetworkCommand('$#');
        parseDeviceResponse(result);
    } catch (error) {
        uni.showToast({
            title: typeof error === 'string' ? error : '设备数据获取失败',
            icon: 'none'
        });
    } finally {
        isRefreshing.value = false;
        if (showLoading) uni.hideLoading();
    }
};

const goBack = () => uni.navigateBack();

const getDeviceControlLabel = () => {
    if (state.controlLoading) return '操作中';
    if (state.controlState === 'unknown' || state.controlState === 'returning') return '不可操作';
    if (state.controlState === 'running') return '暂停';
    return state.controlState === 'paused' ? '继续' : '开始';
};

const handleDeviceControl = async () => {
    if (state.controlLoading) return;
    if (state.controlState === 'unknown' || state.controlState === 'returning') {
        uni.showToast({ title: state.controlState === 'returning' ? '设备归位中，请稍后操作' : '设备状态未确认，暂不可操作', icon: 'none' });
        return;
    }
    const action = state.controlState === 'running' ? 'pause' : 'start';
    const command = action === 'start' ? '$h=1' : '$h=0';

    state.controlLoading = true;
    try {
        await sendNetworkCommand(command);
        state.controlState = action === 'start' ? 'running' : 'paused';
        state.controlStateLabel = action === 'start' ? '运行中' : '暂停';
        await refreshDeviceState();
        uni.showToast({ title: action === 'start' ? '已下发开始指令' : '已下发暂停指令', icon: 'success' });
    } catch (error) {
        uni.showToast({ title: typeof error === 'string' ? error : '操作失败', icon: 'none' });
    } finally {
        state.controlLoading = false;
    }
};

const handleAction = (type) => {
    const deviceCode = encodeURIComponent(state.deviceCode);
    if (type === 'manual') {
        const params = encodeURIComponent(JSON.stringify(state));
        uni.navigateTo({
            url: `/pages/networkDeviceState/paramsSet?deviceCode=${deviceCode}&remarkName=${encodeURIComponent(state.remarkName)}&data=${params}`
        });
    } else {
        const params = encodeURIComponent(JSON.stringify(state.timeSlots || []));
        uni.navigateTo({
            url: `/pages/networkDeviceState/alarmClock?deviceCode=${deviceCode}&data=${params}`
        });
    }
};

const handleRefresh = () => refreshDeviceState({ syncClock: false, showLoading: true });
</script>

<style lang="scss" scoped>
.page-wrapper {
    height: 100vh;
    width: 100vw;
    background-color: #F6F7FB;
    position: relative;
    overflow-y: auto;
    -ms-overflow-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

.bg-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 330rpx;
    background: radial-gradient(circle at top right, $primary-color, $primary-dark);
    border-radius: 0 0 48rpx 48rpx;
    z-index: 1;
}

.container {
    position: relative;
    z-index: 2;
    padding: 0 20rpx;
    padding-top: calc(var(--status-bar-height) + 16rpx);
    padding-bottom: 24rpx;
    padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
    padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14rpx;
    height: 72rpx;
    position: relative;

    .back-btn {
        width: 58rpx;
        height: 58rpx;
        background: transparent;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: bold;
        position: relative;
        z-index: 2;
    }

    .page-title {
        position: absolute;
        left: 0;
        right: 0;
        text-align: center;
        padding: 0 150rpx;
        box-sizing: border-box;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 32rpx;
        font-weight: 600;
        color: #fff;
        z-index: 1;
        pointer-events: none;
    }

    .refresh-btn {
        font-size: 26rpx;
        font-weight: 600;
        color: #fff;
        padding: 10rpx 24rpx;
        background: rgba(255, 255, 255, 0.25);
        border: 1rpx solid rgba(255, 255, 255, 0.35);
        border-radius: 16rpx;
        position: relative;
        z-index: 2;

        &:active {
            opacity: 0.8;
            transform: scale(0.95);
        }
    }
}

.status-card,
.realtime-card,
.parameter-card {
    background: #FFFFFF;
    border: 1rpx solid #E9EEF7;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 22rpx rgba(110, 72, 20, 0.06);
    box-sizing: border-box;
}

.status-card {
    margin-bottom: 22rpx;
    padding: 20rpx 22rpx 16rpx;
}

.status-main {
    display: flex;
    align-items: center;
    min-height: 58rpx;
}

.status-summary {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.device-time {
    display: block;
    text-align: center;
    color: #7B8794;
    font-size: 28rpx;
    font-variant-numeric: tabular-nums;
}

.status-label {
    margin-bottom: 6rpx;
    color: #7B8794;
    font-size: 23rpx;
}

.status-value {
    flex: 1;
    min-width: 0;
    margin-right: 16rpx;
    color: #2D3139;
    font-size: 30rpx;
    font-weight: 800;
    line-height: 1.25;
    overflow-wrap: anywhere;

}

.trip-progress {
    min-width: 0;
}

.trip-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8rpx 16rpx;
    margin-bottom: 12rpx;
}

.trip-count {
    display: flex;
    align-items: baseline;
    justify-content: center;

    .current {
        color: $primary-color;
        font-size: 40rpx;
        font-weight: 800;
    }

    .sep {
        margin: 0 7rpx;
        color: #C4C9D1;
        font-size: 27rpx;
    }

    .total {
        color: #4F5967;
        font-size: 30rpx;
        font-weight: 600;
    }

    .unit {
        margin-left: 5rpx;
        color: #8B95A3;
        font-size: 22rpx;
    }
}

.progress-track {
    height: 16rpx;
    overflow: hidden;
    background: #F0F2F5;
    border-radius: 10rpx;
}

.progress-value {
    height: 100%;
    min-width: 0;
    max-width: 100%;
    background: linear-gradient(90deg, $primary-color, #FFB13B);
    border-radius: 10rpx;
    transition: width 0.3s ease;
}

.device-control-button {
    width: 110rpx;
    height: 56rpx;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, $primary-color, $primary-dark);
    border-radius: 12rpx;
    box-shadow: none;
    color: #FFFFFF;
    font-size: 23rpx;
    font-weight: 600;

    &.disabled {
        background: #D7DCE5;
        box-shadow: none;
        color: #8B95A3;
    }

    &:active:not(.disabled) {
        opacity: 0.8;
        transform: scale(0.96);
    }
}

.status-divider {
    height: 1rpx;
    margin: 16rpx 0 14rpx;
    background: #E4E8EF;
}

.status-health {
    display: flex;
    align-items: center;
}

.health-item {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4rpx 10rpx;
    box-sizing: border-box;
    font-size: 27rpx;
    font-weight: 600;
    line-height: 1.4;
    overflow-wrap: anywhere;

    & + .health-item {
        border-left: 1rpx solid #EEF0F4;
    }

    .health-icon {
        width: 32rpx;
        height: 32rpx;
        flex-shrink: 0;
        margin-right: 12rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #39AD16;
        color: #FFFFFF;
        font-size: 24rpx;
        border-radius: 50%;
    }

    &.status-abnormal .health-icon { background: #D54941; }
    &.status-muted .health-icon { background: #8B95A3; }
}

.realtime-card {
    min-height: 144rpx;
    margin-bottom: 22rpx;
    padding: 0 8rpx;
    display: flex;
    align-items: center;
}

.realtime-metric {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.realtime-label {
    margin-bottom: 16rpx;
    font-size: 24rpx;
    color: #7B8794;
    line-height: 1;
}

.realtime-value-box {
    display: flex;
    align-items: baseline;
}

.realtime-value {
    font-size: 36rpx;
    line-height: 1;
    font-weight: 800;
    color: $primary-color;
    font-variant-numeric: tabular-nums;
}

.status-normal {
    color: #159570;
}

.status-abnormal {
    color: #D54941;
}

.status-muted {
    color: #7B8794;
}

.realtime-unit {
    margin-left: 4rpx;
    font-size: 25rpx;
    color: $primary-color;
}

.realtime-divider {
    width: 1rpx;
    height: 94rpx;
    margin: 0;
    background: #E4E8EF;
}

.action-grid {
    display: flex;
    margin-bottom: 24rpx;

    .action-card {
        flex: 1;
        min-width: 0;
        background: #fff;
        height: 86rpx;
        border: 2rpx solid $primary-color;
        border-radius: 16rpx;
        padding: 0 22rpx;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        box-shadow: none;
        transition: transform 0.2s;

        & + .action-card {
            margin-left: 20rpx;
        }

        &.manual-action .label { color: $primary-color; }
        &.auto-action {
            border-color: #39AD16;
            .label { color: #39AD16; }
        }

        &:active {
            transform: scale(0.96);
        }

        .icon-box {
            width: 48rpx;
            height: 48rpx;
            border-radius: 14rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12rpx;

            .iconfont {
                font-size: 40rpx;
                transition: color 0.3s ease;
            }

            &.manual {
                background: transparent;
                color: $primary-color;
                box-shadow: none;
            }

            &.auto {
                background: transparent;
                color: #52C41A;
                box-shadow: none;
            }
        }

        .label {
            font-size: 29rpx;
            font-weight: 600;
            color: #333;
        }
    }
}

.parameter-card {
    padding: 12rpx 22rpx 18rpx;
}

.parameter-section {
    padding-bottom: 0;

    & + .parameter-section {
        padding-top: 8rpx;
        border-top: 1rpx solid #E4E8EF;
    }

    &.last-section {
        padding-bottom: 0;
    }
}

.section-heading {
    min-height: 62rpx;
    border-bottom: 1rpx solid #E4E8EF;
    display: flex;
    align-items: center;
    color: $primary-color;
    font-size: 29rpx;
    font-weight: 700;

    .heading-mark {
        width: 7rpx;
        height: 34rpx;
        margin-right: 10rpx;
        background: $primary-color;
        border-radius: 7rpx;
    }
}

.parameter-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.parameter-item {
    min-height: 72rpx;
    min-width: 0;
    padding: 10rpx 12rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1rpx solid #E4E8EF;
    box-sizing: border-box;

    &:nth-child(odd) {
        padding-left: 4rpx;
        border-right: 1rpx solid #E4E8EF;
    }

    &:nth-last-child(-n + 2) {
        border-bottom: 0;
    }
}

.parameter-label {
    min-width: 0;
    margin-right: 8rpx;
    color: #7B8794;
    font-size: 24rpx;
    line-height: 1.4;
    overflow-wrap: anywhere;
}

.parameter-value {
    flex-shrink: 0;
    display: flex;
    align-items: baseline;
    color: #2D3139;
    font-size: 26rpx;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;

    &.highlight {
        color: $primary-color;
    }

    .unit {
        margin-left: 3rpx;
        color: #2D3139;
        font-size: 22rpx;
        font-weight: 400;
    }
}
</style>
