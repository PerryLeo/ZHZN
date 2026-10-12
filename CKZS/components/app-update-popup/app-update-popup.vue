<template>
    <view v-if="appUpdateState.visible && appUpdateState.ownerRoute === pageRoute" class="update-mask" @touchmove.stop.prevent @click.stop>
        <view class="update-card" @click.stop>
            <view class="update-mark"><text>↑</text></view>
            <text class="update-heading">发现新版本</text>
            <text class="update-current">当前版本 {{ currentVersion || '--' }}</text>
            <text v-if="release" class="update-version">{{ release.versionName }}</text>
            <text v-if="release" class="update-size">{{ formatSize(release.fileSize) }} · {{ release.forceUpdate ? '需要更新后继续使用' : '建议更新至最新版本' }}</text>
            <view v-if="busy" class="update-progress"><view class="update-progress-track"><view class="update-progress-fill" :style="{ width: progress + '%' }"></view></view><text>{{ stage === 'checking' ? '校验中' : '下载中' }} {{ progress }}%</text></view>
            <text v-if="message" class="update-message" :class="{ error: stage === 'failed' }">{{ message }}</text>
            <button v-if="release" class="update-primary" :disabled="busy || loading" @click="startUpdate">{{ loading ? '正在检查…' : busy ? '正在处理…' : ['ready', 'installing', 'permission'].includes(stage) ? '重新安装' : stage === 'failed' ? '重试更新' : '立即更新' }}</button>
            <button v-if="!busy && !loading && !release?.forceUpdate" class="update-secondary" @click="leave">稍后再说</button>
            <button v-if="!busy && !loading && release?.forceUpdate" class="update-secondary" @click="quit">退出 App</button>
        </view>
    </view>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { getInstalledApp, getAppRelease, downloadAppApk, verifyAppApk, requestApkInstallPermission, removeAppApk, APK_CACHE_KEY, appUpdateState, closeAppUpdate } from '@/common/appUpdate.js';
import { navigateAfterStartup } from '@/common/appStartup.js';

const props = defineProps({ pageRoute: { type: String, required: true } });
const release = ref(null), currentVersion = ref(''), loading = ref(true), busy = ref(false), stage = ref(''), progress = ref(0), message = ref('');
let releaseId = '', source = 'startup', disposed = false, task = null, filePath = '', verifiedPath = '';
const formatSize = bytes => `${(Number(bytes) / 1024 / 1024).toFixed(2)} MB`;
const checkActive = () => { if (disposed) throw new Error('更新已停止'); };
const leave = () => {
    if (busy.value || loading.value || release.value?.forceUpdate) return;
    closeAppUpdate();
    if (source === 'startup') navigateAfterStartup();
};
const quit = () => { if (!busy.value && !loading.value) plus.runtime.quit(); };
const loadRelease = async () => {
    loading.value = true; message.value = '';
    try {
        const current = getInstalledApp();
        if (!current) throw new Error('App 更新仅支持 Android 安装包');
        currentVersion.value = current.versionName;
        const latest = await getAppRelease(releaseId);
        checkActive();
        if (latest.packageName !== current.packageName) throw new Error('发布版本与当前 App 不匹配');
        if (Number(latest.versionCode) <= current.versionCode) {
            release.value = null; loading.value = false;
            uni.showToast({ title: '当前已是最新版本', icon: 'none', duration: 2000 });
            leave(); return;
        }
        release.value = latest;
        const cached = uni.getStorageSync(APK_CACHE_KEY);
        if (cached?.id === latest.id && cached.sha256 === latest.sha256 && cached.filePath) {
            filePath = cached.filePath; stage.value = 'ready'; message.value = '安装包已下载，点击重新安装时会再次校验。';
        } else if (cached?.filePath) {
            removeAppApk(cached.filePath);
            uni.removeStorageSync(APK_CACHE_KEY);
        }
    } catch (error) { message.value = error.message || '无法读取更新信息'; stage.value = 'failed'; }
    finally { loading.value = false; }
};
const startUpdate = async () => {
    if (busy.value || loading.value || !release.value) return;
    busy.value = true;
    try {
        // 再确认发布状态，撤回版本不能继续发起新的下载或安装。
        release.value = await getAppRelease(releaseId);
        checkActive();
        if (!filePath) {
            stage.value = 'downloading'; progress.value = 0; message.value = '正在下载安装包';
            filePath = await downloadAppApk(release.value, value => { if (!disposed) progress.value = value; }, download => { task = download; });
            checkActive();
        }
        stage.value = 'checking'; progress.value = 0; message.value = '正在校验安装包';
        verifiedPath = await verifyAppApk(filePath, release.value, checkActive, value => { progress.value = value; });
        checkActive();
        uni.setStorageSync(APK_CACHE_KEY, { id: releaseId, versionCode: release.value.versionCode, sha256: release.value.sha256, filePath });
        if (!requestApkInstallPermission()) {
            stage.value = 'permission'; message.value = '请允许安装此来源的应用，返回后点击“重新安装”。';
            return;
        }
        stage.value = 'installing'; message.value = '正在打开系统安装界面，请按系统提示完成安装。';
        plus.runtime.install(verifiedPath, {}, () => {
            message.value = '系统安装界面已打开。若取消安装，可以点击“重新安装”。';
        }, error => {
            stage.value = 'failed'; message.value = `安装未完成：${error.message || '请检查安装权限、存储空间和签名'}`;
        });
        console.info('[App更新] 调起系统安装', { versionCode: release.value.versionCode });
    } catch (error) {
        stage.value = 'failed'; message.value = error.message || '更新失败，请重试';
        removeAppApk(filePath); filePath = ''; verifiedPath = ''; uni.removeStorageSync(APK_CACHE_KEY);
        console.info('[App更新] 更新未完成', { message: message.value });
    } finally { busy.value = false; task = null; }
};
watch(() => appUpdateState.visible && appUpdateState.ownerRoute === props.pageRoute, visible => {
    if (!visible) return;
    releaseId = appUpdateState.release.id;
    source = appUpdateState.source;
    release.value = appUpdateState.release;
    stage.value = ''; progress.value = 0; message.value = ''; filePath = ''; verifiedPath = '';
    loadRelease();
}, { immediate: true });
onUnmounted(() => { disposed = true; task?.abort(); });
</script>

<style lang="scss" scoped>
.update-mask { position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 40rpx; background: rgba(0,0,0,0.45); }
.update-card { box-sizing: border-box; width: 100%; max-width: 670rpx; max-height: 85vh; padding: 40rpx; overflow-y: auto; background: #fff; border-radius: 32rpx; text-align: center; }
.update-mark { display: flex; align-items: center; justify-content: center; width: 110rpx; height: 110rpx; margin: 0 auto 24rpx; border-radius: 32rpx; background: $primary-light; color: $primary-color; font-size: 70rpx; font-weight: 600; }
.update-heading { display: block; font-size: 36rpx; font-weight: 700; color: #2D3139; }
.update-current { display: block; margin-top: 16rpx; color: #999; font-size: 24rpx; }
.update-version { display: block; margin-top: 24rpx; font-size: 38rpx; font-weight: 600; color: $primary-color; }
.update-size { display: block; margin-top: 12rpx; font-size: 24rpx; color: #777; }
.update-progress { margin-top: 30rpx; color: $primary-color; font-size: 26rpx; }
.update-progress-track { height: 14rpx; border-radius: 12rpx; background: #F2F2F2; overflow: hidden; margin-bottom: 16rpx; }
.update-progress-fill { height: 100%; background: $primary-color; transition: width 0.2s; }
.update-message { display: block; margin-top: 24rpx; font-size: 26rpx; color: #666; line-height: 1.7; }
.update-message.error { color: #FF4D4F; }
.update-primary, .update-secondary { display: flex; align-items: center; justify-content: center; min-height: 88rpx; font-size: 30rpx; font-weight: 600; border-radius: 44rpx; }
.update-primary { margin-top: 32rpx; background: $primary-color; color: #fff; }
.update-primary[disabled] { background: #FFD5A3; color: #fff; }
.update-secondary { margin-top: 18rpx; color: #666; background: #F5F6FA; }
.update-primary::after, .update-secondary::after { border: none; }
</style>
