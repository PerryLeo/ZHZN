<template>
    <view class="page-wrapper">
        <view class="bg-layer"></view>
        <view class="container">
            <view class="header">
                <view class="back-btn" @click="goBack">
                    <text class="arrow iconfont icon-arrow-left"></text>
                </view>
                <text class="page-title">手动设置</text>
            </view>

            <scroll-view scroll-y class="settings-scroll">
                <view class="settings-group">
                    <view class="setting-item">
                        <text class="label">设备名称</text>
                        <view class="right-box">
                            <input class="item-input highlight" v-model="deviceName" placeholder="请输入设备名称"
                                @blur="handleNameBlur" />
                        </view>
                    </view>
                </view>

                <view class="settings-group">
                    <view class="setting-item">
                        <text class="label">近端等待时间</text>
                        <view class="right-box">
                            <input class="item-input" v-model="nearTime" type="number"
                                @blur="handleDataBlur('$1=', nearTime)" />
                            <text class="unit">s</text>
                        </view>
                    </view>
                    <view class="setting-item">
                        <text class="label">远端等待时间</text>
                        <view class="right-box">
                            <input class="item-input" v-model="remoteTime" type="number"
                                @blur="handleDataBlur('$2=', remoteTime)" />
                            <text class="unit">s</text>
                        </view>
                    </view>
                    <view class="setting-item">
                        <text class="label">手动模式趟数</text>
                        <view class="right-box">
                            <input class="item-input" v-model="manualTrips" type="number"
                                @blur="handleDataBlur('$3=', manualTrips)" />
                            <text class="unit">趟</text>
                        </view>
                    </view>
                    <view class="setting-item">
                        <text class="label">喂食超时时间</text>
                        <view class="right-box">
                            <input class="item-input" v-model="feedTimeout" type="number"
                                @blur="handleDataBlur('$5=', feedTimeout)" />
                            <text class="unit">s</text>
                        </view>
                    </view>
                </view>

                <view class="settings-group">
                    <view class="setting-item">
                        <text class="label">距离软限位</text>
                        <view class="right-box">
                            <input class="item-input" v-model="softLimit" type="number"
                                @blur="handleDataBlur('$7=', softLimit * 10)" />
                            <text class="unit">米</text>
                        </view>
                    </view>
                    <view class="setting-item">
                        <text class="label">送料电机转速</text>
                        <view class="right-box">
                            <input class="item-input" v-model="feedSpeed" type="number"
                                @blur="handleDataBlur('$8=', feedSpeed * 10)" />
                            <text class="unit">圈/秒</text>
                        </view>
                    </view>
                    <view class="setting-item">
                        <text class="label">送料电机扭矩</text>
                        <view class="right-box">
                            <input class="item-input" v-model="motorTorque" type="number"
                                @blur="handleDataBlur('$9=', motorTorque)" />
                            <text class="unit">%</text>
                        </view>
                    </view>
                    <view class="setting-item">
                        <text class="label">移动速度</text>
                        <view class="right-box">
                            <input class="item-input" v-model="moveSpeed" type="number"
                                @blur="handleMoveSpeedBlur" />
                            <text class="unit">%</text>
                        </view>
                    </view>
                </view>

                <view class="settings-group">
                    <view class="setting-item">
                        <text class="label">充电目标电压</text>
                        <view class="right-box"><input class="item-input" v-model="chargingTargetVoltage" type="number" @blur="handleDataBlur('$d=', chargingTargetVoltage * 100)" /><text class="unit">V</text></view>
                    </view>
                    <view class="setting-item">
                        <text class="label">充电电流限制</text>
                        <view class="right-box"><input class="item-input" v-model="chargingCurrentLimit" type="number" @blur="handleDataBlur('$e=', chargingCurrentLimit * 1000)" /><text class="unit">A</text></view>
                    </view>
                    <view class="setting-item">
                        <text class="label">启动最低电压</text>
                        <view class="right-box"><input class="item-input" v-model="startMinimumVoltage" type="number" @blur="handleDataBlur('$f=', startMinimumVoltage * 100)" /><text class="unit">V</text></view>
                    </view>
                    <view class="setting-item">
                        <text class="label">自动关机时间</text>
                        <view class="right-box"><input class="item-input" v-model="autoShutdownTime" type="number" @blur="handleDataBlur('$g=', autoShutdownTime)" /><text class="unit">s</text></view>
                    </view>
                </view>

                <view class="settings-group">
                    <view class="setting-item" @click="openModePicker">
                        <text class="label">运行模式</text>
                        <view class="right-box">
                            <text class="value">{{ runMode }}</text>
                            <text class="iconfont icon-arrow-right"></text>
                        </view>
                    </view>
                    <view class="setting-item">
                        <text class="label">设备版本</text>
                        <view class="right-box">
                            <text class="value">{{ version }}</text>
                        </view>
                    </view>
                    <view class="setting-item">
                        <text class="label">APP版本</text>
                        <view class="right-box">
                            <text class="value">{{ appVersion }}</text>
                        </view>
                    </view>
                    <view class="setting-item">
                        <text class="label">自定义指令</text>
                        <view class="right-box">
                            <input class="item-input" v-model="customCmd" placeholder="请输入指令"
                                @blur="handleAutoDataBlur" />
                        </view>
                    </view>
                </view>

                <view class="settings-group danger-zone">
                    <view class="setting-item center" @click="confirmDelete">
                        <text class="label delete">删除设备</text>
                    </view>
                </view>
                <view class="bottom-placeholder"></view>
            </scroll-view>
        </view>

        <view class="custom-modal-mask" v-if="responseModalVisible" @click="responseModalVisible = false">
            <view class="custom-modal response-modal" @click.stop>
                <view class="modal-header">
                    <text class="modal-title">硬件反馈</text>
                    <text class="close-btn" @click="responseModalVisible = false">✕</text>
                </view>
                <scroll-view scroll-y scroll-x class="modal-body">
                    <text class="response-text">{{ responseContent || '正在等待回复...' }}</text>
                </scroll-view>
                <view class="modal-footer">
                    <button class="copy-btn" @click="copyResponse">复制内容</button>
                </view>
            </view>
        </view>

        <view class="custom-modal-mask" v-if="modeModalVisible" @click="modeModalVisible = false">
            <view class="custom-modal mode-modal" @click.stop>
                <view class="modal-header">
                    <text class="modal-title">请选择运行模式</text>
                </view>
                <view class="mode-list">
                    <view class="mode-option" v-for="(item, index) in ['自动', '手动']" :key="index"
                        :class="{ 'active': runMode === item }" @click="selectMode(index)">
                        <text class="mode-label">{{ item }}</text>
                        <view class="check-circle" v-if="runMode === item">
                            <view class="inner-dot"></view>
                        </view>
                    </view>
                </view>
                <view class="modal-footer">
                    <button class="btn-cancel" @click="modeModalVisible = false">取消</button>
                </view>
            </view>
        </view>

    </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const deviceName = ref('未连接设备');
const remoteTime = ref('0');
const nearTime = ref('0');
const manualTrips = ref('0');
const runMode = ref('未知');
const feedTimeout = ref('0');
const softLimit = ref('0');
const feedSpeed = ref('0');
const motorTorque = ref('0');
const moveSpeed = ref('0');
const chargingTargetVoltage = ref('0');
const chargingCurrentLimit = ref('0');
const startMinimumVoltage = ref('0');
const autoShutdownTime = ref('0');
const version = ref('');
const appVersion = ref('');
const deviceMac = ref('');
const customCmd = ref('');

const responseModalVisible = ref(false);
const responseContent = ref('');
const isWaitingCustom = ref(false);
let readInterval = null;
const modeModalVisible = ref(false);
const isWaitingSync = ref(false);
let syncTimeout = null;

onLoad((options) => {
    if (options.name) deviceName.value = decodeURIComponent(options.name);
    if (options.data) {
        try {
            const data = JSON.parse(decodeURIComponent(options.data));
            remoteTime.value = data.farWaitTime;
            nearTime.value = data.nearWaitTime;
            manualTrips.value = data.manualTripsVal;
            runMode.value = data.runMode;
            feedTimeout.value = data.feedTimeout;
            softLimit.value = (data.softLimit / 10).toFixed(1);
            feedSpeed.value = Number.isInteger(data.feedSpeed / 10) ? data.feedSpeed / 10 : (data.feedSpeed / 10).toFixed(1);
            motorTorque.value = data.motorTorque;
            moveSpeed.value = data.moveSpeed ?? 0;
            chargingTargetVoltage.value = (data.chargingTargetVoltage ?? 0) / 100;
            chargingCurrentLimit.value = (data.chargingCurrentLimit ?? 0) / 1000;
            startMinimumVoltage.value = (data.startMinimumVoltage ?? 0) / 100;
            autoShutdownTime.value = data.autoShutdownTime ?? 0;
            version.value = data.version;
            deviceMac.value = data.mac || '';
        } catch (e) {
            console.error('Data error:', e);
        }
    }

    uni.getSystemInfo({
        success: (res) => {
            appVersion.value = res.appWgtVersion;
        },
        fail: (err) => {
            console.error('获取系统信息失败', err);
        }
    });
    startListening();
});

onMounted(() => {
    if (!readInterval) startListening();
});

onUnmounted(() => {
    if (readInterval) {
        clearInterval(readInterval);
        readInterval = null;
    }
    if (syncTimeout) {
        clearTimeout(syncTimeout);
        syncTimeout = null;
    }
});

const startListening = () => {
    const socket = getApp().globalData?.sppSocket;
    if (!socket || !socket.isConnected()) return;

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
                    let data = '';
                    for (let i = 0; i < available; i++) {
                        let b = inputStream.read();
                        if (b !== -1) data += String.fromCharCode(b);
                    }
                    if (isWaitingCustom.value && data) {
                        isWaitingSync.value = false;
                        responseContent.value += data;
                        responseModalVisible.value = true;
                    }
                    if (isWaitingSync.value && data) {
                        if (data.toLowerCase().includes('ok')) {
                            isWaitingSync.value = false;
                            if (syncTimeout) {
                                clearTimeout(syncTimeout);
                                syncTimeout = null;
                            }
                            uni.showToast({ title: '已同步', icon: 'none' });
                        }
                    }
                }
            } catch (err) {
                clearInterval(readInterval);
            }
        }, 100);
    } catch (e) {
        console.error("Listener error:", e);
    }
};

const goBack = () => uni.navigateBack();

const handleDataBlur = (header, val) => {
    setDeviceData(header + val + '\n')
};

const handleMoveSpeedBlur = () => {
    const value = Number(moveSpeed.value);
    if (!Number.isFinite(value) || value < 50 || value > 100) {
        uni.showToast({ title: '移动速度需为50-100%', icon: 'none' });
        return;
    }
    setDeviceData(`$a=${value}\n`);
};

const handleAutoDataBlur = () => {
    if (!customCmd.value) return;
    responseContent.value = '';
    isWaitingCustom.value = true;
    setDeviceData(customCmd.value);
    setTimeout(() => { isWaitingCustom.value = false; }, 5000);
};

const copyResponse = () => {
    uni.setClipboardData({
        data: responseContent.value,
        success: () => uni.showToast({ title: '已复制', icon: 'none' })
    });
};

const setDeviceData = (cmd) => {
    if (!cmd) return;
    try {
        const app = getApp();
        const socket = app.globalData?.sppSocket;
        if (socket && socket.isConnected()) {
            const outputStream = socket.getOutputStream();
            plus.android.importClass(outputStream);
            const JavaString = plus.android.importClass("java.lang.String");
            const jStr = new JavaString(cmd);
            outputStream.write(jStr.getBytes("US-ASCII"));
            outputStream.flush();
            
            isWaitingSync.value = true;
            syncTimeout = setTimeout(() => {
                if (isWaitingSync.value) {
                    isWaitingSync.value = false;
                    uni.showToast({ title: '同步失败', icon: 'none' });
                }
            }, 5000);
        } else {
            uni.showToast({ title: '蓝牙未连接', icon: 'none' });
        }
    } catch (e) {
        uni.showToast({ title: '发送失败', icon: 'none' });
    }
};

const handleNameBlur = () => {
    const newName = deviceName.value.trim();
    if (!newName) {
        uni.showToast({ title: '名称必填', icon: 'none' });
        return;
    }
    const saved = uni.getStorageSync('SAVED_BLUETOOTH_DEVICES') || [];
    const index = saved.findIndex(d => d.mac === deviceMac.value);
    if (index !== -1) {
        saved[index].name = newName;
        uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', saved);
        uni.$emit('UPDATE_DEVICE_NAME', newName);
        uni.showToast({ title: '已同步', icon: 'none' });
    }
};

const openModePicker = () => { modeModalVisible.value = true; };

const selectMode = (index) => {
    const modes = ['自动', '手动'];
    runMode.value = modes[index];
    handleDataBlur('$4=', index);
    setTimeout(() => { modeModalVisible.value = false; }, 200);
};

const confirmDelete = () => {
    uni.showModal({
        title: '警告',
        content: '确定要删除此设备吗？',
        confirmColor: '#FF4D4F',
        success: (res) => {
            if (res.confirm) {
                try {
                    const app = getApp();
                    const socket = app.globalData?.sppSocket;
                    if (socket && socket.isConnected()) {
                        socket.close();
                        app.globalData.sppSocket = null;
                    }
                } catch (e) { }
                const saved = uni.getStorageSync('SAVED_BLUETOOTH_DEVICES') || [];
                const newList = saved.filter(d => d.mac !== deviceMac.value);
                uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', newList);
                uni.showToast({ title: '已移除' });
                setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 1000);
            }
        }
    });
};
</script>

<style lang="scss" scoped>
.page-wrapper {
    height: 100vh;
    width: 100vw;
    background-color: #F6F7FB;
    position: relative;
    overflow: hidden;
}

.bg-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 380rpx;
    background: radial-gradient(circle at top right, $primary-color, $primary-dark);
    z-index: 1;
}

.container {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding-top: calc(var(--status-bar-height) + 20rpx);
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 88rpx;
    padding: 0 30rpx;
    margin-bottom: 20rpx;
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

        .arrow {
            font-size: 32rpx;
            font-weight: bold;
        }
    }

    .page-title {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        font-size: 34rpx;
        font-weight: 600;
        color: #fff;
        white-space: nowrap;
    }
}

.settings-scroll {
    flex: 1;
    height: 0;
    padding: 20rpx 30rpx;
    box-sizing: border-box;
}

.settings-group {
    background: #fff;
    border-radius: 32rpx;
    margin-bottom: 30rpx;
    overflow: hidden;
    box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.03);

    &.danger-zone {
        margin-top: 60rpx;
        box-shadow: 0 8rpx 30rpx rgba(255, 77, 79, 0.1);
    }
}

.setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 36rpx 30rpx;
    position: relative;

    &:not(:last-child)::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 30rpx;
        right: 0;
        height: 1rpx;
        background: #F2F2F2;
    }

    &:active {
        background-color: #F8F9FA;
    }

    &.center {
        justify-content: center;
    }

    .label {
        font-size: 30rpx;
        color: #333;
        font-weight: 500;

        &.delete {
            color: #FF4D4F;
            font-weight: 600;
        }
    }

    .right-box {
        display: flex;
        align-items: center;
        flex: 1;
        justify-content: flex-end;

        .value {
            font-size: 28rpx;
            color: #999;
            margin-right: 12rpx;

            &.highlight {
                color: $primary-color;
                font-weight: 600;
            }
        }

        .item-input {
            text-align: right;
            font-size: 28rpx;
            color: #666;
            flex: 1;
            padding: 0 10rpx;

            &.highlight {
                color: $primary-color;
                font-weight: 600;
            }
        }

        .unit {
            font-size: 26rpx;
            color: #AAB0BB;
            margin-left: 6rpx;
        }

        .icon-arrow-right {
            font-size: 24rpx;
            color: #ccc;
        }
    }
}

.bottom-placeholder {
    height: 60rpx;
    width: 100%;
}

.custom-modal-mask {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.4);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10rpx);
}

.custom-modal {
    width: 600rpx;
    background: #FFFFFF;
    border-radius: 40rpx;
    overflow: hidden;
    box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    max-height: 80vh;

    .modal-header {
        padding: 40rpx 40rpx 20rpx;
        text-align: center;
        border-bottom: 2rpx solid #F2F2F2;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .modal-title {
            flex: 1;
            font-size: 34rpx;
            font-weight: 700;
            color: #2D3139;
        }

        .close-btn {
            font-size: 40rpx;
            color: #ccc;
            padding: 10rpx;
        }
    }

    .modal-body {
        height: 500rpx;
        padding: 30rpx;
        box-sizing: border-box;
        background: #F8F9FB;

        .response-text {
            display: inline-block;
            min-width: 100%;
            font-size: 28rpx;
            color: #444;
            line-height: 1.6;
            white-space: pre;
            font-family: monospace;
        }
    }

    .modal-footer {
        padding: 30rpx 40rpx;

        .copy-btn {
            height: 88rpx;
            background: $primary-color;
            color: #fff;
            border-radius: 44rpx;
            font-size: 30rpx;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;

            &:active {
                opacity: 0.9;
            }
        }

        .btn-cancel {
            height: 88rpx;
            background: #F5F6FA;
            color: #5E6166;
            border-radius: 44rpx;
            font-size: 30rpx;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;

            &:active {
                background: #EEF0F5;
            }

            &::after {
                border: none;
            }
        }
    }

    .mode-list {
        padding: 20rpx 40rpx 40rpx;

        .mode-option {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 34rpx 40rpx;
            background: #F8F9FB;
            border-radius: 24rpx;
            margin-bottom: 20rpx;
            transition: all 0.2s;
            border: 2rpx solid transparent;

            &:active {
                transform: scale(0.98);
                opacity: 0.8;
            }

            &.active {
                background: rgba($primary-color, 0.05);
                border-color: rgba($primary-color, 0.2);

                .mode-label {
                    color: $primary-color;
                    font-weight: 700;
                }
            }

            .mode-label {
                font-size: 30rpx;
                color: #333;
            }

            .check-circle {
                width: 36rpx;
                height: 36rpx;
                border: 4rpx solid $primary-color;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;

                .inner-dot {
                    width: 18rpx;
                    height: 18rpx;
                    background-color: $primary-color;
                    border-radius: 50%;
                }
            }
        }
    }
}
</style>
