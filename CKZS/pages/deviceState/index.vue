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
                        <text class="connection-status">● 已连接</text>
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
                        <view class="data-item">
                            <view class="val-box">
                                <text class="val">{{ state.manualTripsVal }}</text>
                                <text class="unit">趟</text>
                            </view>
                            <text class="lab">手动模式趟数</text>
                        </view>
                    </view>
                </view>

                <view class="data-card mt-30">
                    <view class="data-row">
                        <view class="data-item border-line">
                            <view class="val-box">
                                <text class="val">{{ state.feedTimeout }}</text>
                                <text class="unit">s</text>
                            </view>
                            <text class="lab">喂食超时时间</text>
                        </view>
                        <view class="data-item border-line">
                            <view class="val-box">
                                <text v-if="state.softLimit && state.softLimit > 0" class="val">
                                    {{ (state.softLimit / 10).toFixed(1) }}
                                </text>
                                <text v-if="state.softLimit && state.softLimit > 0" class="unit">米</text>
                                <text v-else class="val soft-limit-off">关闭</text>
                            </view>
                            <text class="lab">距离软限位</text>
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
                        <view class="data-item">
                            <view class="val-box">
                                <text class="val">{{ state.motorTorque }}</text>
                                <text class="unit">%</text>
                            </view>
                            <text class="lab">送料电机扭矩</text>
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
                        <view class="data-item border-line">
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
import { onLoad, onShow, onHide } from '@dcloudio/uni-app';

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
    deviceStatus: '',
    fanStatus: '',
    version: '',
    deviceTime: '00:00:00',
    mac: '',
    timeSlots: [],
});

const pageTitle = ref('设备状态详情');
const isRefreshing = ref(false);
let readInterval = null;
let isWaitingTimeSync = false;
let timeSyncTimeout = null;

onLoad((options) => {
    if (options.name) pageTitle.value = decodeURIComponent(options.name);
    if (options.mac) state.mac = options.mac;
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

onMounted(() => {
    uni.$on('UPDATE_DEVICE_NAME', (newName) => {
        pageTitle.value = newName;
    });
});

onShow(() => {
    if (state.mac) {
        setTimeout(() => {
            syncTime();
            startListening();
        }, 300);
    }
});

onHide(() => stopListening());

onUnmounted(() => {
    uni.$off('UPDATE_DEVICE_NAME');
    stopListening();
    if (timeSyncTimeout) {
        clearTimeout(timeSyncTimeout);
        timeSyncTimeout = null;
    }
    try {
        const app = getApp();
        const socket = app.globalData?.sppSocket;
        if (socket && socket.isConnected()) {
            socket.close();
            app.globalData.sppSocket = null;
        }
    } catch (e) { }
});

const syncTime = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const cmdTime = hh + mm;

    try {
        const app = getApp();
        const socket = app.globalData?.sppSocket;
        if (socket && socket.isConnected()) {
            const outputStream = socket.getOutputStream();
            plus.android.importClass(outputStream);
            const JavaString = plus.android.importClass("java.lang.String");
            const cmd = new JavaString(`$T=${cmdTime}\n`);
            outputStream.write(cmd.getBytes("US-ASCII"));
            outputStream.flush();
            
            isWaitingTimeSync = true;
            if (timeSyncTimeout) {
                clearTimeout(timeSyncTimeout);
            }
            timeSyncTimeout = setTimeout(() => {
                isWaitingTimeSync = false;
            }, 5000);
        }
    } catch (e) {
        console.error('Sync time failed:', e);
    }
};

const sendInitCommand = () => {
    try {
        const app = getApp();
        const socket = app.globalData?.sppSocket;
        if (socket && socket.isConnected()) {
            const outputStream = socket.getOutputStream();
            plus.android.importClass(outputStream);
            const JavaString = plus.android.importClass("java.lang.String");
            const cmd = new JavaString("$#");
            outputStream.write(cmd.getBytes("US-ASCII"));
            outputStream.flush();
        } else {
            isRefreshing.value = false;
            uni.hideLoading();
            uni.showToast({ title: '蓝牙未连接', icon: 'none' });
        }
    } catch (e) {
        isRefreshing.value = false;
        uni.hideLoading();
    }
};

const stopListening = () => {
    if (readInterval) {
        clearInterval(readInterval);
        readInterval = null;
    }
};

const startListening = () => {
    const socket = getApp().globalData?.sppSocket;
    if (!socket || !socket.isConnected()) return;

    let dataBuffer = '';
    try {
        const inputStream = socket.getInputStream();
        plus.android.importClass(inputStream);

        readInterval = setInterval(() => {
            try {
                if (!socket || !socket.isConnected()) {
                    clearInterval(readInterval);
                    return;
                }
                const available = inputStream.available();
                if (available > 0) {
                    for (let i = 0; i < available; i++) {
                        let b = inputStream.read();
                        if (b !== -1) dataBuffer += String.fromCharCode(b);
                    }
                    if (dataBuffer.includes('\n')) {
                        const lines = dataBuffer.split('\n');
                        dataBuffer = dataBuffer.endsWith('\n') ? '' : lines.pop();
                        lines.forEach(line => {
                            const cleanLine = line.trim();
                            if (cleanLine) parseLine(cleanLine);
                        });
                    }
                }
            } catch (err) {
                clearInterval(readInterval);
            }
        }, 200);
    } catch (e) { }
};

const parseLine = (line) => {
    if (isRefreshing.value) {
        isRefreshing.value = false;
        uni.hideLoading();
    }

    if (line.toLowerCase().includes('ok') && isWaitingTimeSync) {
        sendInitCommand();
        isWaitingTimeSync = false;
        if (timeSyncTimeout) {
            clearTimeout(timeSyncTimeout);
            timeSyncTimeout = null;
        }
        return;
    }

    if (line.startsWith('<') && line.endsWith('>')) {
        const content = line.slice(1, -1);
        const parts = content.split('|');
        const statusMap = {
            'Unreturn': '未归位',
            'Pause': '暂停',
            'Idle': '空闲',
            'Waiting': '等待中',
            'running': '运行中'
        };
        state.deviceStatus = statusMap[parts[0]] || parts[0];
        parts.forEach(part => {
            if (part.includes('Fan:')) state.fanStatus = part.split(':')[1];
            if (part.includes('Times:')) state.currentTrip = parseInt(part.split(':')[1]);
        });
        return;
    }

    if (line.startsWith('Time:')) {
        const timePart = line.replace('Time:', '').trim();
        if (timePart) {
            state.deviceTime = timePart;
        }
        return;
    }

    if (line.startsWith('Ver:')) {
        state.version = line.replace('Ver:', '').trim();
        return;
    }

    const match = line.match(/^\$(\d+)=(\d+)/);
    if (match) {
        const key = match[1];
        const val = parseInt(match[2]);
        switch (key) {
            case '1': state.nearWaitTime = val; break;
            case '2': state.farWaitTime = val; break;
            case '3': state.manualTripsVal = val; break;
            case '4':
                const modeMap = { 0: '自动', 1: '手动', 2: '撒药' };
                state.runMode = modeMap[val] || '未知';
                break;
            case '5': state.feedTimeout = val; break;
            case '6': state.feedTime = val; break;
            case '7': state.softLimit = val; break;
            case '8': state.feedSpeed = val; break;
            case '9': state.motorTorque = val; break;
        }
    }

    const timeMatch = line.match(/^\$([H-S])=(\d{6})/);
    if (timeMatch) {
        const letter = timeMatch[1];
        const raw = timeMatch[2];
        const trips = parseInt(raw.slice(0, 2));
        const hour = raw.slice(2, 4);
        const minute = raw.slice(4, 6);
        const timeStr = `${hour}:${minute}`;
        const index = letter.charCodeAt(0) - 'H'.charCodeAt(0);
        state.timeSlots[index] = { time: timeStr, trips: trips };
    }
};

const goBack = () => uni.navigateBack();

const handleAction = (type) => {
    if (type === 'manual') {
        const params = encodeURIComponent(JSON.stringify(state));
        uni.navigateTo({
            url: `/pages/deviceState/paramsSet?name=${encodeURIComponent(pageTitle.value)}&data=${params}`
        });
    } else {
        const params = encodeURIComponent(JSON.stringify(state.timeSlots || []));
        uni.navigateTo({
            url: `/pages/deviceState/alarmClock?data=${params}`
        });
    }
};

const handleRefresh = () => {
    isRefreshing.value = true;
    uni.showLoading({ title: '正在刷新...', mask: true });
    syncTime();
    setTimeout(() => {
        if (isRefreshing.value) {
            isRefreshing.value = false;
            uni.hideLoading();
        }
    }, 3000);
};
</script>

<style lang="scss" scoped>
.page-wrapper {
    height: 100vh;
    width: 100vw;
    background-color: #F6F7FB;
    position: relative;
    overflow-y: auto;
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
    padding-top: calc(var(--status-bar-height) + 20rpx);
    padding-bottom: 40rpx;
    padding-bottom: calc(40rpx + constant(safe-area-inset-bottom));
    padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40rpx;
    height: 88rpx;
    position: relative;

    .back-btn {
        width: 70rpx;
        height: 70rpx;
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
        font-size: 34rpx;
        font-weight: 600;
        color: #fff;
        z-index: 1;
        pointer-events: none;
    }

    .refresh-btn {
        font-size: 30rpx;
        font-weight: 600;
        color: #fff;
        padding: 12rpx 32rpx;
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
    margin-bottom: 60rpx;

    .progress-ring-container {
        position: relative;
        width: 420rpx;
        height: 420rpx;
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
            transform-origin: 10rpx 210rpx;

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
            width: 380rpx;
            height: 380rpx;
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
            }
        }
    }
}

.action-grid {
    display: flex;
    margin-bottom: 40rpx;

    .action-card {
        flex: 1;
        min-width: 0;
        background: #fff;
        border-radius: 36rpx;
        padding: 40rpx;
        display: flex;
        flex-direction: column;
        align-items: center;
        box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.04);
        transition: transform 0.2s;

        & + .action-card {
            margin-left: 30rpx;
        }

        &:active {
            transform: scale(0.96);
        }

        .icon-box {
            width: 90rpx;
            height: 90rpx;
            border-radius: 28rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20rpx;

            .iconfont {
                font-size: 48rpx;
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
            font-size: 28rpx;
            font-weight: 500;
            color: #333;
        }
    }
}

.data-card {
    background: #fff;
    border-radius: 32rpx;
    padding: 45rpx 0;
    box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.04);

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
                top: 20%;
                height: 60%;
                width: 1rpx;
                background: rgba(0, 0, 0, 0.05);
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

.mt-30 {
    margin-top: 30rpx;
}
</style>
