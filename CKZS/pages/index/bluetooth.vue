<template>
    <view class="page-wrapper">
        <view class="radar-section">
            <view class="back-btn" @click="goBack">
                <text class="arrow iconfont icon-arrow-left"></text>
            </view>
            <view class="radar-container">
                <view class="radar-pulse" :class="{ 'animating': state.isScanning }"></view>
                <view class="radar-pulse delay-1" :class="{ 'animating': state.isScanning }"></view>
                <view class="radar-pulse delay-2" :class="{ 'animating': state.isScanning }"></view>
                <view class="radar-core">
                    <svg class="radar-svg" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M512 448c-13 8.5-12.2 28.3 1.4 35.5h179.3l-61.5 314.9c-4.1 20.9 15.6 37.4 32.9 26.1l321.3-343.3c13-8.6 12.2-28.5-1.4-35.6z"
                            fill="#FFF" opacity="0.9" />
                    </svg>
                </view>
            </view>
            <view class="scan-status">
                <text class="status-text">{{ state.isScanning ? '正在搜索周围目标设备...' : '搜索已停止' }}</text>
                <text class="status-sub">请确保设备蓝牙已开启</text>
            </view>
        </view>

        <view class="list-section">
            <view class="section-header">
                <text class="title">发现列表</text>
                <text class="count" v-if="state.devices.length > 0">共发现 {{ state.devices.length }} 台设备</text>
            </view>
            <scroll-view scroll-y class="device-scroll">
                <view class="device-list" v-if="state.devices.length > 0">
                    <view class="device-card" v-for="(item, index) in state.devices" :key="index"
                        @click="connectDevice(item)">
                        <view class="d-avatar">
                            <text class="iconfont icon-lanya"></text>
                        </view>
                        <view class="d-info">
                            <view class="name-box">
                                <text class="d-name">{{ item.name }}</text>
                                <text class="abnormal-tag" v-if="item.isAbnormal">异常</text>
                            </view>
                            <text class="d-mac">MAC: {{ item.mac }}</text>
                        </view>
                        <view class="d-action">
                            <view class="signal-box">
                                <view class="signal-icon">
                                    <view class="signal-bar" :class="{ 'active': item.signalLevel >= 1 }"
                                        :style="{ backgroundColor: item.signalLevel >= 1 ? item.signalColor : '#E0E0E0' }">
                                    </view>
                                    <view class="signal-bar" :class="{ 'active': item.signalLevel >= 2 }"
                                        :style="{ backgroundColor: item.signalLevel >= 2 ? item.signalColor : '#E0E0E0' }">
                                    </view>
                                    <view class="signal-bar" :class="{ 'active': item.signalLevel >= 3 }"
                                        :style="{ backgroundColor: item.signalLevel >= 3 ? item.signalColor : '#E0E0E0' }">
                                    </view>
                                    <view class="signal-bar" :class="{ 'active': item.signalLevel >= 4 }"
                                        :style="{ backgroundColor: item.signalLevel >= 4 ? item.signalColor : '#E0E0E0' }">
                                    </view>
                                </view>
                            </view>
                            <view class="connect-btn">连接</view>
                        </view>
                    </view>
                    <view style="height: 1rpx;"></view>
                </view>
                <view class="empty-state" v-else>
                    <view class="empty-orb"></view>
                    <text>暂未发现新设备</text>
                </view>
            </scroll-view>
        </view>

        <view class="footer-action">
            <button class="action-btn" :class="{ 'outline': state.isScanning }" @click="toggleScan">
                <text>{{ state.isScanning ? '停止搜索' : '重新搜索' }}</text>
            </button>
        </view>
    </view>
</template>

<script setup>
import { onMounted, onUnmounted, reactive } from 'vue';

const state = reactive({
    isScanning: false,
    devices: [],
});

const BluetoothAdapter = plus.android.importClass("android.bluetooth.BluetoothAdapter");
const BluetoothDevice = plus.android.importClass("android.bluetooth.BluetoothDevice");
const IntentFilter = plus.android.importClass('android.content.IntentFilter');
const BAdapter = BluetoothAdapter.getDefaultAdapter();
let receiver = null;
let isConnecting = false;
let isRequestingBluetoothPermission = false;

const waitForDiscoveryStopped = (timeout = 1500) => new Promise(resolve => {
    const startedAt = Date.now();
    const check = () => {
        let isDiscovering = false;
        try { isDiscovering = BAdapter && BAdapter.isDiscovering(); } catch (e) { }
        if (!isDiscovering || Date.now() - startedAt >= timeout) return resolve();
        setTimeout(check, 100);
    };
    check();
});

const getConnectErrorMessage = (error) => {
    const message = String(error?.message || error || '');
    if (/permission|securityexception/i.test(message)) return '蓝牙权限不足，请检查系统授权';
    if (/timeout|timed out|read failed|socket might closed/i.test(message)) return '连接超时，请确认设备可连接后重试';
    return '连接失败，请确认设备已配对且在附近';
};

const startScan = () => {
    if (isRequestingBluetoothPermission) return;
    if (!BAdapter.isEnabled()) {
        uni.showToast({ title: '请先开启蓝牙', icon: 'none' });
        return;
    }
    // Android 12（API 31）及以上的蓝牙扫描不依赖定位服务，避免误拦截。
    const BuildVersion = plus.android.importClass('android.os.Build$VERSION');
    const sdkVersion = Number(BuildVersion.SDK_INT);
    if (sdkVersion < 31) {
        const context = plus.android.importClass("android.content.Context");
        const locationManager = plus.android.importClass("android.location.LocationManager");
        const main = plus.android.runtimeMainActivity();
        const mainSvr = main.getSystemService(context.LOCATION_SERVICE);
        if (!mainSvr.isProviderEnabled(locationManager.GPS_PROVIDER)) {
            uni.showModal({ title: '提示', content: '请在系统设置中开启定位服务(GPS)后搜索', showCancel: false });
            return;
        }
    }
    const permissions = sdkVersion >= 31
        ? ['android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT']
        : ['android.permission.ACCESS_FINE_LOCATION'];

    isRequestingBluetoothPermission = true;
    plus.android.requestPermissions(
        permissions,
        (e) => {
            isRequestingBluetoothPermission = false;
            if (e.deniedPresent.length > 0 || e.deniedAlways.length > 0) {
                uni.showToast({ title: sdkVersion >= 31 ? '附近设备权限缺失' : '定位权限缺失', icon: 'none' });
                return;
            }
            executeNativeDiscovery();
        },
        (e) => {
            isRequestingBluetoothPermission = false;
            console.error('[蓝牙权限申请失败]', e);
            uni.showToast({ title: '蓝牙权限申请失败', icon: 'none' });
        }
    );
};

const getSignalLevel = (rssi) => {
    if (rssi >= -50) return 4;
    if (rssi >= -70) return 3;
    if (rssi >= -85) return 2;
    if (rssi < 0) return 1;
    return 0;
};

const getSignalColor = (level) => {
    if (level >= 3) return '#52C41A';
    if (level === 2) return '#FAAD14';
    if (level === 1) return '#FF4D4F';
    return '#E0E0E0';
};

const executeNativeDiscovery = () => {
    const main = plus.android.runtimeMainActivity();
    const filter = new IntentFilter();
    stopScan();
    state.isScanning = true;
    state.devices = [];
    const saved = uni.getStorageSync('SAVED_BLUETOOTH_DEVICES') || [];
    const savedMacs = Array.isArray(saved) ? saved.map(d => d.mac) : [];
    receiver = plus.android.implements('io.dcloud.android.content.BroadcastReceiver', {
        onReceive: function (context, intent) {
            plus.android.importClass(intent);
            const action = intent.getAction();
            if (action == BluetoothDevice.ACTION_FOUND) {
                const device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                const name = device.getName();
                const mac = device.getAddress();
                const rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, 0);
                const signalLevel = getSignalLevel(rssi);
                const signalColor = getSignalColor(signalLevel);
                const isTarget = name && (name.startsWith('HF-SPP') || name.startsWith('LY-SPP') || name.startsWith('JDY'));
                if (isTarget && !state.devices.find(d => d.mac === mac) && !savedMacs.includes(mac)) {
                    state.devices.push({
                        name, mac, rssi, signalLevel, signalColor,
                        isAbnormal: name.startsWith('HF-SPP') || name.startsWith('JDY')
                    });
                }
            } else if (action == BluetoothAdapter.ACTION_DISCOVERY_FINISHED) {
                stopScan();
            }
        }
    });
    filter.addAction(BluetoothDevice.ACTION_FOUND);
    filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
    main.registerReceiver(receiver, filter);
    if (!BAdapter.startDiscovery()) stopScan();
};

const stopScan = () => {
    state.isScanning = false;
    if (BAdapter.isDiscovering()) BAdapter.cancelDiscovery();
    if (receiver) {
        plus.android.runtimeMainActivity().unregisterReceiver(receiver);
        receiver = null;
    }
};

const toggleScan = () => state.isScanning ? stopScan() : startScan();

const connectDevice = (device) => {
    if (isConnecting) return;
    isConnecting = true;
    stopScan();
    uni.showLoading({ title: '正在连接...', mask: true });
    waitForDiscoveryStopped().then(() => {
        let socket = null;
        try {
            // 释放旧连接，避免同一手机保留多个 RFCOMM Socket。
            try { getApp().globalData?.sppSocket?.close(); } catch (e) { }
            getApp().globalData.sppSocket = null;
            const remoteDevice = BAdapter.getRemoteDevice(device.mac);
            plus.android.importClass(remoteDevice);
            const UUID = plus.android.importClass("java.util.UUID");
            socket = remoteDevice.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"));
            plus.android.importClass(socket);
            socket.connect();
            if (!socket.isConnected()) {
                throw new Error('Socket 未连接');
            }
            getApp().globalData.sppSocket = socket;
            let saved = uni.getStorageSync('SAVED_BLUETOOTH_DEVICES') || [];
            if (!saved.find(d => d.mac === device.mac)) {
                saved.push({ name: device.name, initialName: device.name, remarkName: device.name, mac: device.mac, addTime: Date.now() });
                uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', saved);
            }
            uni.showToast({ title: '连接成功', icon: 'success' });
            setTimeout(() => {
                uni.navigateTo({ url: `/pages/deviceState/index?name=${encodeURIComponent(device.name)}&initialName=${encodeURIComponent(device.name)}&remarkName=${encodeURIComponent(device.name)}&mac=${device.mac}` });
            }, 1000);
        } catch (e) {
            console.error('[蓝牙连接失败]', e);
            try { socket?.close(); } catch (closeError) { }
            uni.showToast({ title: getConnectErrorMessage(e), icon: 'none' });
        } finally {
            isConnecting = false;
            uni.hideLoading();
        }
    });
};

const goBack = () => uni.navigateBack();
onMounted(() => startScan());
onUnmounted(() => stopScan());
</script>

<style lang="scss" scoped>
.page-wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background-color: #F6F7FB;
    overflow: hidden;
}

.radar-section {
    height: 550rpx;
    flex-shrink: 0;
    background: radial-gradient(circle at center, $primary-color, $primary-dark);
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: var(--status-bar-height);
    border-radius: 0 0 100rpx 100rpx;
    box-shadow: 0 15rpx 40rpx rgba($primary-color, 0.2);

    .back-btn {
        position: absolute;
        top: calc(var(--status-bar-height) + 20rpx);
        left: 40rpx;
        width: 70rpx;
        height: 70rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        z-index: 100;
        color: #fff;

        .arrow {
            font-size: 32rpx;
            font-weight: bold;
            margin-left: -4rpx;
        }
    }

    .radar-container {
        width: 320rpx;
        height: 320rpx;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 40rpx;

        .radar-pulse {
            position: absolute;
            width: 100%;
            height: 100%;
            border: 2rpx solid rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            opacity: 0;

            &.animating {
                animation: pulse 3s infinite linear;
            }

            &.delay-1 {
                animation-delay: 1s;
            }

            &.delay-2 {
                animation-delay: 2s;
            }
        }

        .radar-core {
            width: 120rpx;
            height: 120rpx;
            background: #FFF;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 40rpx rgba(255, 255, 255, 0.5);
            z-index: 10;

            .radar-svg {
                width: 60rpx;
                height: 60rpx;

                path {
                    fill: $primary-color;
                }
            }
        }
    }

    .scan-status {
        text-align: center;

        .status-text {
            display: block;
            color: #FFF;
            font-size: 32rpx;
            font-weight: 600;
            margin-bottom: 12rpx;
        }

        .status-sub {
            color: rgba(255, 255, 255, 0.7);
            font-size: 22rpx;
        }
    }
}

@keyframes pulse {
    0% {
        transform: scale(0.5);
        opacity: 0.8;
    }

    100% {
        transform: scale(2.2);
        opacity: 0;
    }
}

.list-section {
    flex: 1;
    height: 0;
    padding: 40rpx 40rpx 0 40rpx;
    display: flex;
    flex-direction: column;

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30rpx;

        .title {
            font-size: 36rpx;
            font-weight: 700;
            color: #2D3139;
        }

        .count {
            font-size: 24rpx;
            color: #AAB0BB;
        }
    }

    .device-scroll {
        flex: 1;
        height: 0;
    }
}

.device-card {
    background: #FFF;
    border-radius: 32rpx;
    padding: 30rpx;
    display: flex;
    align-items: center;
    margin-bottom: 24rpx;
    box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.03);
    transition: all 0.2s;

    &:active {
        transform: scale(0.98);
        background-color: #F8F9FA;
    }

    .d-avatar {
        width: 100rpx;
        height: 100rpx;
        background: #F1F4F9;
        border-radius: 28rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 24rpx;

        text {
            color: $primary-color;
            font-size: 60rpx;
            font-weight: bold;
        }
    }

    .d-info {
        flex: 1;
        width: calc(100% - 250rpx);

        .name-box {
            display: flex;
            align-items: center;
            margin-bottom: 8rpx;

            .d-name {
                font-size: 30rpx;
                font-weight: 600;
                color: #2D3139;
                word-break: break-all;
                margin-right: 12rpx;
            }

            .abnormal-tag {
                font-size: 20rpx;
                background-color: #FF4D4F;
                color: #FFFFFF;
                padding: 2rpx 10rpx;
                border-radius: 6rpx;
                flex-shrink: 0;
            }
        }

        .d-mac {
            font-size: 20rpx;
            color: #AAB0BB;
        }
    }

    .d-action {
        width: 120rpx;
        display: flex;
        flex-direction: column;
        align-items: flex-end;

        .signal-box {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            margin-bottom: 16rpx;

            .signal-icon {
                display: flex;
                align-items: flex-end;
                height: 32rpx;

                .signal-bar {
                    width: 8rpx;
                    background-color: #E0E0E0;
                    border-radius: 2rpx;

                    & + .signal-bar {
                        margin-left: 4rpx;
                    }

                    &:nth-child(1) {
                        height: 12rpx;
                    }

                    &:nth-child(2) {
                        height: 20rpx;
                    }

                    &:nth-child(3) {
                        height: 28rpx;
                    }

                    &:nth-child(4) {
                        height: 36rpx;
                    }
                }
            }
        }

        .connect-btn {
            padding: 8rpx 24rpx;
            background: rgba($primary-color, 0.1);
            color: $primary-color;
            border-radius: 100rpx;
            font-size: 22rpx;
            font-weight: 600;
        }
    }
}

.empty-state {
    padding-top: 100rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #BEC4CC;
    font-size: 26rpx;

    .empty-orb {
        width: 120rpx;
        height: 120rpx;
        border: 4rpx dashed #AAB0BB;
        border-radius: 50%;
        margin-bottom: 24rpx;
        opacity: 0.5;
    }
}

.footer-action {
    padding: 40rpx;
    width: 100%;
    box-sizing: border-box;
    padding-bottom: calc(env(safe-area-inset-bottom) + 30rpx);
    background: linear-gradient(to top, #F6F7FB 80%, rgba(246, 247, 251, 0));
    display: flex;
    flex-direction: column;
    align-items: center;

    .action-btn {
        width: 100%;
        height: 100rpx;
        background: $primary-color;
        color: #FFF;
        border-radius: 50rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32rpx;
        font-weight: 600;
        box-shadow: 0 10rpx 20rpx rgba($primary-color, 0.3);
        margin-bottom: 20rpx;
        border: none;

        &.outline {
            background: transparent;
            border: 2rpx solid $primary-color;
            color: $primary-color;
            box-shadow: none;
        }
    }
}
</style>
