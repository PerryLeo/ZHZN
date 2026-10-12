<template>
    <view v-if="visible" class="ota-mask" @click="close">
        <view class="ota-panel" @click.stop>
            <view class="ota-header">
                <text class="ota-title">OTA升级</text>
                <text v-if="!busy" class="ota-close" @click="close">✕</text>
            </view>
            <view class="ota-device">
                <text class="ota-device-name">{{ deviceName }}</text>
                <text class="ota-muted">当前版本：{{ currentVersion || '未知' }}</text>
            </view>

            <template v-if="!stage">
                <view class="ota-list-heading">
                    <text>选择固件</text>
                    <text class="ota-refresh" @click="loadFirmwares">{{ loading ? '加载中…' : '刷新' }}</text>
                </view>
                <scroll-view scroll-y class="ota-list">
                    <view v-if="loading" class="ota-empty">正在获取可用固件…</view>
                    <view v-else-if="listError" class="ota-empty ota-error">{{ listError }}</view>
                    <view v-else-if="!firmwares.length" class="ota-empty">暂无可用固件</view>
                    <view v-else v-for="file in firmwares" :key="file.firmwareFile" class="ota-file"
                        :class="{ selected: selected?.firmwareFile === file.firmwareFile }" @click="selected = file">
                        <view class="ota-file-content">
                            <text class="ota-file-version">{{ file.firmwareVersion || '未识别版本' }}</text>
                            <text class="ota-filename">{{ file.firmwareFile }}</text>
                            <text class="ota-muted">{{ formatSize(file.firmwareSize) }} · {{ formatDate(file.updatedAt) }}</text>
                        </view>
                        <view class="ota-radio"><view v-if="selected?.firmwareFile === file.firmwareFile" class="ota-radio-dot"></view></view>
                    </view>
                </scroll-view>
                <text class="ota-hint">请选择适用于当前设备的固件。升级时保持设备供电和蓝牙连接。</text>
            </template>

            <view v-else class="ota-status">
                <text class="ota-status-title" :class="{ 'ota-error': stage === 'failed' }">{{ statusTitle }}</text>
                <text class="ota-status-version">{{ selected?.firmwareVersion || selected?.firmwareFile }}</text>
                <view v-if="busy || stage === 'rebooting'" class="ota-progress-track">
                    <view class="ota-progress-fill" :style="{ width: progress + '%' }"></view>
                </view>
                <text v-if="busy" class="ota-progress-number">{{ progress }}%</text>
                <text class="ota-status-message">{{ message }}</text>
                <text v-if="busy" class="ota-hint">请保持 App 在前台，不要关闭蓝牙或断开设备电源。</text>
                <text v-if="stage === 'rebooting'" class="ota-hint">设备校验通过，已发送重启指令；新版本运行状态需重新连接后确认。</text>
            </view>

            <view class="ota-footer">
                <button v-if="!stage" class="ota-primary" :disabled="!selected || loading" @click="confirmUpgrade">下载并升级</button>
                <button v-else-if="busy" class="ota-primary" disabled>升级进行中</button>
                <template v-else>
                    <button v-if="stage === 'failed'" class="ota-primary" @click="resetSelection">重新选择固件</button>
                    <button class="ota-secondary" @click="close">{{ stage === 'rebooting' ? '完成' : '关闭' }}</button>
                </template>
            </view>
        </view>
    </view>
</template>

<script setup>
import { computed, ref, onUnmounted } from 'vue';
import http from '@/common/request.js';
import { getBluetoothOtaSocket, downloadBluetoothFirmware, readVerifiedFirmware, createBluetoothOtaTransport, removeFirmwareFile } from '@/common/bluetoothOta.js';
import { transferBluetoothFirmware } from '@/common/otaProtocol.js';

const props = defineProps({ deviceName: { type: String, default: '当前设备' }, currentVersion: { type: String, default: '' } });
const emit = defineEmits(['busy-change']);
const visible = ref(false);
const busy = ref(false);
const loading = ref(false);
const firmwares = ref([]);
const selected = ref(null);
const listError = ref('');
const stage = ref('');
const progress = ref(0);
const message = ref('');
let operation = null;
let disposed = false;
const statusTitle = computed(() => ({ downloading: '正在下载固件', checking: '正在校验文件', starting: '准备升级', transferring: '正在传输固件', verifying: '设备正在校验', rebooting: '固件传输完成', failed: '升级未完成' }[stage.value] || 'OTA升级'));
const formatSize = size => Number(size) >= 1024 * 1024 ? `${(Number(size) / 1024 / 1024).toFixed(2)} MB` : `${(Number(size) / 1024).toFixed(1)} KB`;
const formatDate = value => value ? String(value).slice(0, 10) : '日期未知';

const loadFirmwares = async () => {
    if (loading.value || busy.value) return;
    loading.value = true;
    listError.value = '';
    selected.value = null;
    try {
        const result = await http.get('/api/ota/bluetooth/firmwares');
        if (disposed) return;
        firmwares.value = Array.isArray(result) ? result : [];
    } catch (error) {
        listError.value = typeof error === 'string' ? error : error.message || '固件列表获取失败';
    } finally { loading.value = false; }
};

const open = () => {
    if (busy.value) return;
    try { getBluetoothOtaSocket(); } catch (error) {
        uni.showToast({ title: error.message, icon: 'none', duration: 2000 });
        return;
    }
    visible.value = true;
    stage.value = '';
    progress.value = 0;
    loadFirmwares();
};
const close = () => { if (!busy.value) visible.value = false; };
const resetSelection = () => { stage.value = ''; loadFirmwares(); };
const confirmUpgrade = () => {
    if (!selected.value || busy.value) return;
    uni.showModal({
        title: '确认蓝牙升级',
        content: `将为“${props.deviceName}”安装 ${selected.value.firmwareVersion || selected.value.firmwareFile}，请确认固件适用于当前设备，并保持设备供电。`,
        confirmText: '开始升级',
        confirmColor: '#FF8C00',
        success: result => { if (result.confirm && visible.value && !disposed) startUpgrade(); },
    });
};

const startUpgrade = async () => {
    if (busy.value) return;
    const file = selected.value;
    let socket;
    try {
        socket = getBluetoothOtaSocket();
        if (!file || !Number.isInteger(Number(file.firmwareSize)) || Number(file.firmwareSize) <= 0 || Number(file.firmwareSize) > 10 * 1024 * 1024 || !/^[a-f0-9]{64}$/i.test(file.firmwareSha256)) {
            throw new Error('固件信息不完整或超过 10 MB，请刷新列表');
        }
    } catch (error) {
        uni.showToast({ title: error.message, icon: 'none', duration: 2000 });
        return;
    }
    const current = { cancelled: false, download: null, transport: null, filePath: '' };
    operation = current;
    const checkActive = () => {
        if (current.cancelled || disposed) throw new Error('升级已中断，请重新连接设备后确认状态');
    };
    busy.value = true;
    emit('busy-change', true);
    uni.setKeepScreenOn({ keepScreenOn: true });
    stage.value = 'downloading';
    progress.value = 0;
    message.value = '正在下载所选固件';
    console.info('[蓝牙OTA] 开始', { firmwareFile: file.firmwareFile, firmwareSize: file.firmwareSize });
    try {
        current.filePath = await downloadBluetoothFirmware(file, value => { if (!current.cancelled) progress.value = value; }, task => { current.download = task; });
        checkActive();
        stage.value = 'checking';
        message.value = '正在校验固件大小和 SHA-256';
        const firmware = await readVerifiedFirmware(current.filePath, file);
        checkActive();
        // 下载结束后再启动独占读流，所有升级帧通过现有 SPP Socket 发送。
        if (getBluetoothOtaSocket() !== socket) throw new Error('蓝牙连接已变化，请重新开始升级');
        current.transport = createBluetoothOtaTransport(socket);
        await transferBluetoothFirmware({ firmware, transport: current.transport, checkActive, onProgress: state => {
            stage.value = state.stage;
            progress.value = state.progress;
            message.value = state.message;
        } });
        console.info('[蓝牙OTA] 固件校验通过，已发送重启指令', { firmwareFile: file.firmwareFile });
    } catch (error) {
        stage.value = 'failed';
        message.value = current.cancelled ? '升级因离开前台而中断，请重新连接设备后确认状态。' : error.message || '升级失败，请重新连接后重试';
        console.error('[蓝牙OTA] 升级未完成', { message: message.value });
    } finally {
        current.transport?.close();
        removeFirmwareFile(current.filePath);
        uni.setKeepScreenOn({ keepScreenOn: false });
        operation = null;
        busy.value = false;
        emit('busy-change', false);
    }
};
const cancel = () => {
    if (!operation) return;
    operation.cancelled = true;
    operation.download?.abort();
    operation.transport?.close();
};
onUnmounted(() => { disposed = true; cancel(); });
defineExpose({ open, cancel });
</script>

<style lang="scss" scoped>
.ota-mask { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 1000; padding: 30rpx; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; }
.ota-panel { width: 100%; max-width: 660rpx; max-height: 85vh; display: flex; flex-direction: column; background: #fff; border-radius: 40rpx; overflow: hidden; box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15); }
.ota-header { display: flex; align-items: center; padding: 34rpx 36rpx 22rpx; border-bottom: 2rpx solid #F2F2F2; }
.ota-title { flex: 1; font-size: 34rpx; font-weight: 700; color: #2D3139; }
.ota-close { padding: 8rpx; color: #999; font-size: 34rpx; }
.ota-device { display: flex; flex-direction: column; padding: 24rpx 36rpx; background: #F8F9FB; }
.ota-device-name { font-size: 28rpx; color: #333; font-weight: 600; margin-bottom: 8rpx; }
.ota-muted { font-size: 23rpx; color: #999; line-height: 1.6; }
.ota-list-heading { display: flex; justify-content: space-between; padding: 24rpx 36rpx 14rpx; font-size: 28rpx; color: #333; }
.ota-refresh { color: $primary-color; }
.ota-list { height: 30vh; max-height: 350rpx; flex-shrink: 0; }
.ota-empty { padding: 60rpx 36rpx; text-align: center; font-size: 26rpx; color: #999; }
.ota-file { display: flex; align-items: center; margin: 12rpx 36rpx; padding: 22rpx; border: 2rpx solid transparent; border-radius: 24rpx; background: #F8F9FB; }
.ota-file.selected { background: $primary-light; border-color: rgba($primary-color, 0.35); }
.ota-file-content { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ota-file-version { font-size: 28rpx; color: #333; font-weight: 600; }
.selected .ota-file-version { color: $primary-color; }
.ota-filename { font-size: 22rpx; color: #777; margin: 8rpx 0; word-break: break-all; }
.ota-radio { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32rpx; height: 32rpx; margin-left: 18rpx; border: 2rpx solid #CCC; border-radius: 50%; }
.selected .ota-radio { border-color: $primary-color; }
.ota-radio-dot { width: 18rpx; height: 18rpx; background: $primary-color; border-radius: 50%; }
.ota-hint { display: block; padding: 16rpx 36rpx 0; font-size: 23rpx; line-height: 1.7; color: #999; }
.ota-status { padding: 40rpx 36rpx 16rpx; text-align: center; }
.ota-status-title { display: block; font-size: 32rpx; font-weight: 600; color: $primary-color; }
.ota-status-version { display: block; margin-top: 14rpx; color: #777; font-size: 24rpx; word-break: break-all; }
.ota-progress-track { height: 16rpx; margin-top: 32rpx; background: #F2F2F2; border-radius: 12rpx; overflow: hidden; }
.ota-progress-fill { height: 100%; background: $primary-color; border-radius: 12rpx; transition: width 0.2s; }
.ota-progress-number { display: block; margin-top: 16rpx; font-size: 36rpx; font-weight: 600; color: $primary-color; }
.ota-status-message { display: block; margin-top: 20rpx; font-size: 26rpx; line-height: 1.7; color: #666; word-break: break-all; }
.ota-status .ota-hint { padding: 16rpx 0 0; }
.ota-error { color: #FF4D4F; }
.ota-footer { padding: 24rpx 36rpx 32rpx; }
.ota-primary, .ota-secondary { display: flex; align-items: center; justify-content: center; min-height: 88rpx; border-radius: 44rpx; font-size: 30rpx; font-weight: 600; }
.ota-primary { background: $primary-color; color: #fff; }
.ota-primary[disabled] { background: #FFD5A3; color: #fff; }
.ota-secondary { background: #F5F6FA; color: #5E6166; }
.ota-primary + .ota-secondary { margin-top: 16rpx; }
.ota-primary::after, .ota-secondary::after { border: none; }
</style>
