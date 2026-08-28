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

            <view class="progress-section">
                <view class="progress-ring-container">
                    <view class="progress-ring" :style="{ background: ringGradient }"></view>
                    <view class="progress-cap start"></view>
                    <view class="progress-cap end" :style="{ transform: `rotate(${progressRotation}deg)` }"></view>
                    <view class="ring-mask"></view>
                    <view class="status-content">
                        <view class="device-time">
                            <text class="iconfont icon-shijian"></text>
                            <text class="time-val">{{ state.deviceTime }}</text>
                        </view>
                        <text class="status-label">当前状态</text>
                        <text class="status-value">{{ state.deviceStatus }}</text>
                        <view class="trip-count">
                            <text class="current">{{ state.currentTrip }}</text>
                            <text class="sep">/</text>
                            <text class="total">{{ state.manualTripsVal }}</text>
                            <text class="unit">趟</text>
                        </view>
                    </view>
                </view>
            </view>

            <view class="realtime-card">
                <view class="realtime-metric">
                    <text class="realtime-label">电量</text>
                    <view class="realtime-value-box">
                        <text class="realtime-value">{{ formatRealtimeValue(state.batteryLevel) }}</text>
                        <text v-if="state.batteryLevel !== null" class="realtime-unit">%</text>
                    </view>
                </view>
                <view class="realtime-divider"></view>
                <view class="realtime-metric">
                    <text class="realtime-label">电流</text>
                    <view class="realtime-value-box">
                        <text class="realtime-value">{{ formatRealtimeValue(state.chargingCurrent) }}</text>
                        <text v-if="state.chargingCurrent !== null" class="realtime-unit">A</text>
                    </view>
                </view>
                <view class="realtime-divider"></view>
                <view class="realtime-control">
                    <text class="realtime-control-label">设备操作</text>
                    <view
                        class="realtime-control-button"
                        :class="{ disabled: state.controlLoading || state.controlState === 'unknown' || state.controlState === 'returning' }"
                        @click="handleDeviceControl"
                    >
                        <text>{{ getDeviceControlLabel() }}</text>
                    </view>
                </view>
            </view>

            <view class="realtime-card">
                <view class="realtime-metric">
                    <text class="realtime-label">身份状态</text>
                    <view class="realtime-status-value-box">
                        <view :class="['realtime-status-value', state.identityMismatch ? 'status-abnormal' : 'status-normal']">
                            {{ state.identityMismatch ? '身份异常' : '身份正常' }}
                        </view>
                    </view>
                </view>
                <view class="realtime-divider"></view>
                <view class="realtime-metric">
                    <text class="realtime-label">异常状态</text>
                    <view class="realtime-status-value-box">
                        <view :class="['realtime-status-value', state.hasAlarm ? 'status-abnormal' : 'status-muted']">
                            {{ state.abnormalStatus }}
                        </view>
                    </view>
                </view>
            </view>

            <view class="action-grid">
                <view class="action-card" @click="handleAction('manual')">
                    <view class="icon-box manual">
                        <text class="iconfont icon-shoudong"></text>
                    </view>
                    <text class="label">手动设置</text>
                </view>
                <view class="action-card" @click="handleAction('auto')">
                    <view class="icon-box auto">
                        <text class="iconfont icon-zidong"></text>
                    </view>
                    <text class="label">自动设置</text>
                </view>
            </view>

            <view class="detail-list">
                <view class="data-card">
                    <view class="data-row">
                        <view class="data-item border-line">
                            <view class="val-box">
                                <text class="val">{{ state.nearWaitTime }}</text>
                                <text class="unit">s</text>
                            </view>
                            <text class="lab">近端等待时间</text>
                        </view>
                        <view class="data-item border-line">
                            <view class="val-box">
                                <text class="val">{{ state.farWaitTime }}</text>
                                <text class="unit">s</text>
                            </view>
                            <text class="lab">远端等待时间</text>
                        </view>
                        <view class="data-item border-line">
                            <view class="val-box">
                                <text class="val">{{ state.manualTripsVal }}</text>
                                <text class="unit">趟</text>
                            </view>
                            <text class="lab">手动模式趟数</text>
                        </view>
                        <view class="data-item">
                            <view class="val-box">
                                <text class="val">{{ state.feedTimeout }}</text>
                                <text class="unit">s</text>
                            </view>
                            <text class="lab">喂食超时时间</text>
                        </view>
                    </view>
                </view>

                <view class="data-card mt-30">
                    <view class="data-row">
                        <view class="data-item border-line">
                            <view class="val-box"><text class="val">{{ state.chargingTargetVoltage / 100 }}</text><text class="unit">V</text></view>
                            <text class="lab">充电目标电压</text>
                        </view>
                        <view class="data-item border-line">
                            <view class="val-box"><text class="val">{{ state.chargingCurrentLimit / 1000 }}</text><text class="unit">A</text></view>
                            <text class="lab">充电电流预警</text>
                        </view>
                        <view class="data-item border-line">
                            <view class="val-box"><text class="val">{{ state.startMinimumVoltage / 100 }}</text><text class="unit">V</text></view>
                            <text class="lab">启动最低电压</text>
                        </view>
                        <view class="data-item">
                            <view class="val-box"><text class="val">{{ state.autoShutdownTime }}</text><text class="unit">s</text></view>
                            <text class="lab">自动关机时间</text>
                        </view>
                    </view>
                </view>

                <view class="data-card mt-30">
                    <view class="data-row">
                        <view class="data-item border-line">
                            <view class="val-box">
                                <text v-if="state.softLimit && state.softLimit > 0" class="val">
                                    {{ (state.softLimit / 100).toFixed(2) }}
                                </text>
                                <text v-if="state.softLimit && state.softLimit > 0" class="unit">米</text>
                                <text v-else class="val soft-limit-off">关闭</text>
                            </view>
                            <text class="lab">软限位距离</text>
                        </view>
                        <view class="data-item border-line">
                            <view class="val-box">
                                <text class="val">
                                    {{ Number.isInteger(state.feedSpeed / 10) ? state.feedSpeed / 10 : (state.feedSpeed
                                        / 10).toFixed(1) }}
                                </text>
                                <text class="unit">圈/秒</text>
                            </view>
                            <text class="lab">送料电机转速</text>
                        </view>
                        <view class="data-item border-line">
                            <view class="val-box">
                                <text class="val">{{ state.motorTorque }}</text>
                                <text class="unit">%</text>
                            </view>
                            <text class="lab">送料电机扭矩</text>
                        </view>
                        <view class="data-item">
                            <view class="val-box">
                                <text class="val">{{ state.moveSpeed }}</text>
                                <text class="unit">%</text>
                            </view>
                            <text class="lab">移动速度</text>
                        </view>
                    </view>
                </view>

                <view class="data-card mt-30">
                    <view class="data-row">
                        <view class="data-item border-line">
                            <view class="val-box">
                                <text class="val highlight">{{ state.runMode }}</text>
                            </view>
                            <text class="lab">运行模式</text>
                        </view>
                        <view class="data-item">
                            <view class="val-box">
                                <text class="val" :class="{ 'highlight': state.fanStatus === 'ON' }">{{ state.fanStatus
                                    === 'ON' ? '开启' : '关闭' }}</text>
                            </view>
                            <text class="lab">风扇</text>
                        </view>
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
    controlState: 'unknown',
    controlStateLabel: '状态未知',
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

const ringGradient = computed(() => {
    const p = percentage.value;
    return `conic-gradient(#3A8DFF 0%, #00D2FF ${p}%, #F2F5FA ${p}%, #F2F5FA 100%)`;
});

const progressRotation = computed(() => (percentage.value / 100) * 360);

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
    return { state: 'unknown', label: '状态未知' };
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
    height: 440rpx;
    background: radial-gradient(circle at top right, $primary-color, $primary-dark);
    border-radius: 0 0 60rpx 60rpx;
    z-index: 1;
}

.container {
    position: relative;
    z-index: 2;
    padding: 0 30rpx;
    padding-top: calc(var(--status-bar-height) + 16rpx);
    padding-bottom: 30rpx;
    padding-bottom: calc(30rpx + constant(safe-area-inset-bottom));
    padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18rpx;
    height: 80rpx;
    position: relative;

    .back-btn {
        width: 64rpx;
        height: 64rpx;
        background: rgba(255, 255, 255, 0.25);
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
        font-size: 32rpx;
        font-weight: 600;
        color: #fff;
        z-index: 1;
        pointer-events: none;
    }

    .refresh-btn {
        font-size: 28rpx;
        font-weight: 600;
        color: #fff;
        padding: 11rpx 28rpx;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 36rpx;
        position: relative;
        z-index: 2;

        &:active {
            opacity: 0.8;
            transform: scale(0.95);
        }
    }
}

.progress-section {
    display: flex;
    justify-content: center;
    margin-bottom: 20rpx;

    .progress-ring-container {
        position: relative;
        width: 370rpx;
        height: 370rpx;
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 20rpx 50rpx rgba(0, 0, 0, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;

        .progress-ring {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            transition: background 0.3s ease;
        }

        .progress-cap {
            position: absolute;
            width: 20rpx;
            height: 20rpx;
            background: #3A8DFF;
            border-radius: 50%;
            z-index: 5;
            top: 0;
            left: 50%;
            margin-left: -10rpx;
            transform-origin: 10rpx 185rpx;

            &.start {
                box-shadow: 0 4rpx 10rpx rgba(58, 141, 255, 0.3);
            }

            &.end {
                background: #00D2FF;
                box-shadow: 0 4rpx 10rpx rgba(0, 210, 255, 0.3);
            }
        }

        .ring-mask {
            position: absolute;
            width: 340rpx;
            height: 340rpx;
            background: #fff;
            border-radius: 50%;
            z-index: 2;
            box-shadow: inset 0 0 20rpx rgba(0, 0, 0, 0.02);
        }

        .status-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 10;

            .device-time {
                display: flex;
                align-items: center;
                margin-bottom: 12rpx;
                background: rgba($primary-color, 0.08);
                padding: 6rpx 20rpx;
                border-radius: 20rpx;
                border: 1px solid rgba($primary-color, 0.1);

                .iconfont {
                    font-size: 26rpx;
                    color: $primary-color;
                    margin-right: 8rpx;
                }

                .time-val {
                    font-size: 26rpx;
                    font-weight: 600;
                    color: $primary-color;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 1rpx;
                }
            }

            .status-label {
                font-size: 24rpx;
                color: #999;
                margin-bottom: 6rpx;
            }

            .status-value {
                font-size: 40rpx;
                font-weight: 800;
                color: #2D3139;
                margin-bottom: 15rpx;
            }

            .trip-count {
                display: flex;
                align-items: baseline;
                margin-bottom: 20rpx;

                .current {
                    font-size: 40rpx;
                    font-weight: bold;
                    color: $primary-color;
                }

                .sep {
                    font-size: 28rpx;
                    color: #ccc;
                    margin: 0 8rpx;
                }

                .total {
                    font-size: 32rpx;
                    color: #666;
                }

                .unit {
                    font-size: 24rpx;
                    color: #999;
                    margin-left: 6rpx;
                }
            }

            .connection-status {
                font-size: 22rpx;
                color: #52C41A;
                background: rgba(82, 196, 26, 0.1);
                padding: 4rpx 16rpx;
                border-radius: 100rpx;

                &.abnormal {
                    color: #D54941;
                    background: rgba(213, 73, 65, 0.1);
                }
            }
        }
    }
}

.realtime-card {
    height: 104rpx;
    margin: 0 0 20rpx;
    padding: 0 18rpx;
    display: flex;
    align-items: center;
    background: #FFFFFF;
    border: 1rpx solid #E9EEF7;
    border-radius: 24rpx;
    box-shadow: 0 8rpx 22rpx rgba(31, 71, 124, 0.05);
    box-sizing: border-box;
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
    margin-bottom: 8rpx;
    font-size: 19rpx;
    color: #7B8794;
    line-height: 1;
}

.realtime-value-box {
    display: flex;
    align-items: baseline;
}

.realtime-value {
    font-size: 30rpx;
    line-height: 1;
    font-weight: 800;
    color: $primary-color;
    font-variant-numeric: tabular-nums;
}

.realtime-status-value-box {
    min-height: 40rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.realtime-status-value {
    max-width: 280rpx;
    padding: 0;
    font-size: 22rpx;
    line-height: 1.4;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
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
    font-size: 18rpx;
    color: #7B8794;
}

.realtime-divider {
    width: 1rpx;
    height: 52rpx;
    margin: 0;
    background: rgba(58, 141, 255, 0.15);
}

.realtime-control {
    flex: 1;
    min-width: 0;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.realtime-control-label {
    margin-bottom: 8rpx;
    font-size: 19rpx;
    line-height: 1;
    color: #7B8794;
}

.realtime-control-button {
    width: 116rpx;
    height: 44rpx;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 22rpx;
    background: $primary-color;
    box-shadow: 0 6rpx 12rpx rgba(58, 141, 255, 0.2);
    color: #FFFFFF;
    font-size: 22rpx;
    font-weight: 600;
    box-sizing: border-box;

    &.disabled {
        background: #D7DCE5;
        color: #8B95A3;
        box-shadow: none;
    }

    &:active:not(.disabled) {
        opacity: 0.8;
    }
}

.action-grid {
    display: flex;
    margin-bottom: 20rpx;

    .action-card {
        flex: 1;
        min-width: 0;
        background: #fff;
        border: 1rpx solid #E9EEF7;
        border-radius: 24rpx;
        padding: 32rpx 32rpx;
        display: flex;
        flex-direction: column;
        align-items: center;
        box-shadow: 0 8rpx 22rpx rgba(31, 71, 124, 0.05);
        transition: transform 0.2s;

        & + .action-card {
            margin-left: 20rpx;
        }

        &:active {
            transform: scale(0.96);
        }

        .icon-box {
            width: 72rpx;
            height: 72rpx;
            border-radius: 20rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 18rpx;

            .iconfont {
                font-size: 40rpx;
                transition: color 0.3s ease;
            }

            &.manual {
                background: rgba($primary-color, 0.1);
                color: $primary-color;
                box-shadow: 0 8rpx 20rpx rgba($primary-color, 0.2);
            }

            &.auto {
                background: rgba(#52C41A, 0.1);
                color: #52C41A;
                box-shadow: 0 8rpx 20rpx rgba(#52C41A, 0.2);
            }
        }

        .label {
            font-size: 26rpx;
            font-weight: 500;
            color: #333;
        }
    }
}

.data-card {
    background: #fff;
    border: 1rpx solid #E9EEF7;
    border-radius: 24rpx;
    padding: 30rpx 0;
    box-shadow: 0 8rpx 22rpx rgba(31, 71, 124, 0.05);

    .data-row {
        display: flex;

        .data-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            min-width: 0;

            &.border-line::after {
                content: '';
                position: absolute;
                right: 0;
                top: 50%;
                height: 52rpx;
                width: 1rpx;
                background: rgba(58, 141, 255, 0.15);
                transform: translateY(-50%);
            }

            .val-box {
                display: flex;
                align-items: baseline;
                height: 40rpx;
                margin-bottom: 8rpx;

                .val {
                    font-size: 32rpx;
                    font-weight: 700;
                    color: #2D3139;
                    white-space: nowrap;

                    &.soft-limit-off {
                        font-size: 30rpx;
                        font-weight: 700;
                    }

                    &.highlight {
                        color: $primary-color;
                    }
                }

                .unit {
                    font-size: 20rpx;
                    color: #999;
                    margin-left: 4rpx;
                    font-weight: 400;
                    white-space: nowrap;
                }
            }

            .lab {
                font-size: 20rpx;
                color: #999;
                white-space: nowrap;
            }
        }
    }
}

.detail-list {
    display: flex;
    flex-direction: column;

    .data-card:nth-child(1) { order: 1; }
    .data-card:nth-child(2) { order: 3; }
    .data-card:nth-child(3) { order: 2; }
    .data-card:nth-child(4) { order: 4; }
}

.mt-30 {
    margin-top: 20rpx;
}
</style>
