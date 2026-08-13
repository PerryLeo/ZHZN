<template>
    <view class="page-wrapper" :class="{ 'syncing': isSyncing }">
        <view class="bg-layer"></view>

        <view class="container">
            <view class="header">
                <view class="back-btn" @click="goBack">
                    <text class="arrow iconfont icon-arrow-left"></text>
                </view>
                <text class="page-title">自动设置</text>
                <view class="header-right">
                    <view class="header-btn" @click="helpModalVisible = true">功能说明</view>
                    <view class="header-btn" @click="!isSyncing && syncTime()">同步时间</view>
                    <view class="header-btn" :class="{ 'disabled': isSyncing }" @click="!isSyncing && refreshData()">
                        {{ isSyncing ? '同步中' : '保存' }}
                    </view>
                </view>
            </view>

            <scroll-view scroll-y class="slots-scroll">
                <view class="settings-group">
                    <view class="setting-item" v-for="(item, index) in timeSlots" :key="index">
                        <text class="label">时间段{{ index + 1 }}</text>
                        <view class="right-box">
                            <view class="edit-zone">
                                <view class="current-time" @click="openCustomPicker(index)">
                                    <text class="value highlight">{{ isEmptySlot(item) ? '--:--' : item.time }}</text>
                                </view>
                                <view class="input-wrap">
                                    <input v-if="!isEmptySlot(item)" class="trips-input" v-model="item.trips"
                                        type="number" />
                                    <text v-else class="trips-placeholder">-</text>
                                    <text class="unit-text">趟</text>
                                </view>
                            </view>
                            <view class="def-zone" v-if="defaultTimeSlots.length > 0">
                                <view class="def-line">
                                    <text class="def-val">{{ isEmptySlot(defaultTimeSlots[index]) ? '--:--' :
                                        defaultTimeSlots[index].time }}</text>
                                    <text class="def-val def-trips">{{ isEmptySlot(defaultTimeSlots[index]) ? '-趟' :
                                        defaultTimeSlots[index].trips + '趟' }}</text>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
                <view class="bottom-placeholder"></view>
            </scroll-view>

            <view class="footer-bar">
                <view class="footer-btn save" @click="!isSyncing && saveDefault()">导入默认配置</view>
                <view class="footer-btn load" @click="!isSyncing && loadDefault()">导出默认配置</view>
            </view>
        </view>

        <my-datetime v-if="pickerShow" :pickerShow="pickerShow" :pickerVal="editTimeValue" pickerType="time"
            @sureClk="onConfirmTime" @closePicker="onClosePicker" />

        <view class="custom-modal-mask" v-if="helpModalVisible" @click="helpModalVisible = false">
            <view class="custom-modal help-modal" @click.stop>
                <view class="modal-header">
                    <text class="modal-title">功能说明</text>
                    <text class="close-btn" @click="helpModalVisible = false">✕</text>
                </view>
                <view class="modal-body">
                    <view class="help-item">
                        <view class="help-label">
                            <view class="dot import"></view>
                            <text class="txt">导入默认配置</text>
                        </view>
                        <text class="help-content">从手机本地加载您之前保存的“常用模板”，快速填充当前 12 个时间段。</text>
                    </view>
                    <view class="help-item">
                        <view class="help-label">
                            <view class="dot export"></view>
                            <text class="txt">导出默认配置</text>
                        </view>
                        <text class="help-content">将当前调整好的 12 个时间段保存为您的“常用模板”，方便下次一键恢复。</text>
                    </view>
                </view>
                <view class="modal-footer">
                    <button class="btn-confirm" @click="helpModalVisible = false">我知道了</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import myDatetime from '@/components/w-datetime/w-datetime.vue';
import http from '@/common/request.js';

const pickerShow = ref(false);
const editTimeValue = ref('');
const editTimeIndex = ref(-1);
const isSyncing = ref(false);
const helpModalVisible = ref(false);
const deviceCode = ref('');

const defaultTimeSlots = ref([]);
const STORAGE_KEY = 'NETWORK_ALARM_CLOCK_DEFAULT_CONFIG';

const timeSlots = ref(Array.from({ length: 12 }, () => ({
    time: '00:00',
    trips: 0
})));

const isEmptySlot = (slot) => !slot || (slot.time === '00:00' && parseInt(slot.trips) === 0);

const loadStorageDefault = () => {
    const saved = uni.getStorageSync(STORAGE_KEY);
    if (!saved) return;
    try {
        defaultTimeSlots.value = JSON.parse(saved);
    } catch (error) {
        defaultTimeSlots.value = [];
    }
};

onLoad((options) => {
    loadStorageDefault();
    if (options.deviceCode) deviceCode.value = decodeURIComponent(options.deviceCode);
    if (options.data) {
        try {
            const data = JSON.parse(decodeURIComponent(options.data));
            if (Array.isArray(data)) {
                data.forEach((item, index) => {
                    if (item && timeSlots.value[index]) {
                        timeSlots.value[index].time = item.time;
                        timeSlots.value[index].trips = item.trips;
                    }
                });
            }
        } catch (error) {
            console.error('数据解析异常:', error);
        }
    }
});

const goBack = () => uni.navigateBack();

const sendNetworkCommand = (data, timeout = 10000) => {
    return http.post('/api/devices/command', {
        deviceCode: deviceCode.value,
        type: 'send',
        params: { data },
        timeout
    }, { timeout: timeout + 2000 });
};

const refreshData = async () => {
    if (!deviceCode.value || isSyncing.value) return;

    isSyncing.value = true;
    uni.showLoading({ title: '正在同步...', mask: true });

    const modes = 'HIJKLMNOPQRS';
    try {
        for (let index = 0; index < timeSlots.value.length; index++) {
            const item = timeSlots.value[index];
            const trips = Math.max(0, parseInt(item.trips) || 0);
            const tripsStr = String(trips).padStart(2, '0');
            const timeStr = String(item.time || '00:00').replace(':', '');
            await sendNetworkCommand(`$${modes[index]}=${tripsStr}${timeStr}`);
        }
        uni.showToast({ title: '同步成功', icon: 'success' });
    } catch (error) {
        uni.showToast({
            title: typeof error === 'string' ? error : '同步失败',
            icon: 'none'
        });
    } finally {
        isSyncing.value = false;
        uni.hideLoading();
    }
};

const openCustomPicker = (index) => {
    editTimeIndex.value = index;
    editTimeValue.value = timeSlots.value[index].time;
    pickerShow.value = true;
};

const onConfirmTime = (value) => {
    if (editTimeIndex.value > -1) {
        timeSlots.value[editTimeIndex.value].time = value;
    }
    pickerShow.value = false;
};

const onClosePicker = () => {
    pickerShow.value = false;
};

const saveDefault = () => {
    if (defaultTimeSlots.value.length === 0) {
        uni.showToast({ title: '暂无默认配置', icon: 'none' });
        return;
    }
    uni.showModal({
        title: '导入确认',
        content: '确定要将默认配置覆盖到当前编辑区吗？',
        success: (res) => {
            if (res.confirm) {
                timeSlots.value = JSON.parse(JSON.stringify(defaultTimeSlots.value));
                uni.showToast({ title: '导入成功' });
            }
        }
    });
};

const loadDefault = () => {
    uni.showModal({
        title: '导出确认',
        content: '确定要将当前配置保存为默认吗？',
        success: (res) => {
            if (res.confirm) {
                const data = JSON.parse(JSON.stringify(timeSlots.value));
                uni.setStorageSync(STORAGE_KEY, JSON.stringify(data));
                defaultTimeSlots.value = data;
                uni.showToast({ title: '保存成功' });
            }
        }
    });
};

const syncTime = async () => {
    if (!deviceCode.value || isSyncing.value) return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    isSyncing.value = true;
    uni.showLoading({ title: '同步中...', mask: true });
    try {
        await sendNetworkCommand(`$T=${hh}${mm}`);
        uni.showToast({ title: '已同步设备时间', icon: 'success' });
    } catch (error) {
        uni.showToast({
            title: typeof error === 'string' ? error : '同步失败',
            icon: 'none'
        });
    } finally {
        isSyncing.value = false;
        uni.hideLoading();
    }
};
</script>

<style lang="scss" scoped>
.page-wrapper {
    height: 100vh;
    width: 100vw;
    background-color: #F6F7FB;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: opacity 0.3s;

    &.syncing {
        pointer-events: none;
    }
}

.bg-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 280rpx;
    background: radial-gradient(circle at top right, $primary-color, $primary-dark);
    z-index: 0;
}

.container {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-top: var(--status-bar-height);
    overflow: hidden;
    box-sizing: border-box;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 88rpx;
    padding: 0 30rpx;
    flex-shrink: 0;

    .back-btn {
        width: 70rpx;
        height: 70rpx;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;

        .arrow {
            font-size: 32rpx;
            font-weight: bold;
            color: #fff;
        }
    }

    .page-title {
        flex: 1;
        font-size: 34rpx;
        font-weight: 600;
        color: #fff;
        margin-left: 80rpx;
    }

    .header-right {
        display: flex;
        align-items: center;
    }

    .header-btn {
        font-size: 22rpx;
        font-weight: 600;
        color: #fff;
        padding: 8rpx 16rpx;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 36rpx;
        white-space: nowrap;

        & + .header-btn {
            margin-left: 10rpx;
        }

        &.disabled {
            opacity: 0.6;
        }

        &:active {
            opacity: 0.8;
            transform: scale(0.95);
        }
    }
}

.slots-scroll {
    flex: 1;
    overflow: hidden;
    padding: 20rpx 30rpx 0;
    box-sizing: border-box;
}

.settings-group {
    background: #fff;
    border-radius: 28rpx;
    overflow: hidden;
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.06);
    margin-bottom: 20rpx;
}

.setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 38rpx 30rpx;
    position: relative;

    &:not(:last-child)::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 30rpx;
        right: 0;
        height: 1rpx;
        background: #F0F0F0;
    }

    &:active {
        background-color: #FAFAFA;
    }

    .label {
        font-size: 30rpx;
        color: #333;
        font-weight: 500;
    }

    .right-box {
        display: flex;
        align-items: center;
        flex: 1;
        justify-content: flex-end;

        .edit-zone {
            display: flex;
            align-items: center;
            height: 40rpx;
            flex-shrink: 0;
            margin-right: 24rpx;

            .current-time {
                height: 40rpx;
                display: flex;
                align-items: center;
                flex-shrink: 0;

                .value {
                    line-height: 40rpx;
                    white-space: nowrap;

                    &.highlight {
                        color: $primary-color;
                        font-weight: bold;
                        font-size: 30rpx;
                    }
                }
            }

            .input-wrap {
                height: 40rpx;
                box-sizing: border-box;
                display: flex;
                align-items: center;
                flex-shrink: 0;
                margin-left: 15rpx;
                background: #F2F5FA;
                padding: 0 12rpx;
                border-radius: 8rpx;

                .trips-input {
                    width: 44rpx;
                    height: 40rpx;
                    line-height: 40rpx;
                    text-align: center;
                    font-size: 26rpx;
                    color: #333;
                    font-weight: 600;
                }

                .trips-placeholder {
                    width: 44rpx;
                    line-height: 40rpx;
                    text-align: center;
                    font-size: 30rpx;
                    color: #999;
                    font-weight: bold;
                }

                .unit-text {
                    line-height: 40rpx;
                    font-size: 20rpx;
                    color: #999;
                }
            }
        }

        .def-zone {
            display: flex;
            align-items: center;
            flex-shrink: 0;
            padding-left: 24rpx;
            border-left: 2rpx solid #EAEAEA;

            .def-line {
                height: 40rpx;
                display: flex;
                align-items: center;
                flex-wrap: nowrap;

                .def-val {
                    display: block;
                    font-size: 26rpx;
                    line-height: 40rpx;
                    color: #909399;
                    font-weight: 500;
                    white-space: nowrap;

                    &.def-trips {
                        margin-left: 12rpx;
                    }
                }
            }
        }
    }
}

.bottom-placeholder {
    height: 20rpx;
}

.footer-bar {
    flex-shrink: 0;
    display: flex;
    padding: 20rpx 30rpx;
    padding-bottom: calc(env(safe-area-inset-bottom) + 20rpx);
    background: #F6F7FB;
    border-top: 1rpx solid rgba(0, 0, 0, 0.04);

    .footer-btn {
        flex: 1;
        height: 96rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 48rpx;
        font-size: 28rpx;
        font-weight: 600;

        & + .footer-btn {
            margin-left: 24rpx;
        }

        &.save {
            background: #fff;
            color: $primary-color;
            border: 2rpx solid $primary-color;
            box-shadow: 0 4rpx 12rpx rgba($primary-color, 0.1);
        }

        &.load {
            background: linear-gradient(135deg, $primary-color, $primary-dark);
            color: #fff;
            box-shadow: 0 8rpx 20rpx rgba($primary-color, 0.25);
        }

        &:active {
            transform: scale(0.96);
            opacity: 0.88;
        }
    }
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
    backdrop-filter: blur(8rpx);
}

.custom-modal {
    width: 620rpx;
    background: #fff;
    border-radius: 40rpx;
    overflow: hidden;
    box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;

    .modal-header {
        padding: 40rpx 40rpx 20rpx;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .modal-title {
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
        padding: 20rpx 40rpx 40rpx;

        .help-item {
            background: #F8F9FB;
            padding: 24rpx;
            border-radius: 20rpx;
            margin-bottom: 24rpx;

            .help-label {
                display: flex;
                align-items: center;
                margin-bottom: 12rpx;

                .dot {
                    width: 12rpx;
                    height: 12rpx;
                    flex-shrink: 0;
                    margin-right: 12rpx;
                    border-radius: 50%;

                    &.import {
                        background: $primary-color;
                    }

                    &.export {
                        background: #52C41A;
                    }
                }

                .txt {
                    font-size: 28rpx;
                    font-weight: 600;
                    color: #333;
                }
            }

            .help-content {
                font-size: 24rpx;
                color: #666;
                line-height: 1.6;
            }
        }
    }

    .modal-footer {
        padding: 0 40rpx 40rpx;

        .btn-confirm {
            height: 88rpx;
            background: linear-gradient(135deg, $primary-color, $primary-dark);
            color: #fff;
            border-radius: 44rpx;
            font-size: 30rpx;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;

            &:active {
                opacity: 0.9;
                transform: scale(0.98);
            }

            &::after {
                border: none;
            }
        }
    }
}
</style>
