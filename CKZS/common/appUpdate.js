import { reactive } from 'vue';
import { API_BASE_URL } from './config.js';
import { decodeBase64 } from './otaProtocol.js';

export const APK_CACHE_KEY = 'APP_UPDATE_APK';
export const appUpdateState = reactive({ visible: false, release: null, ownerRoute: '', source: 'background' });
export const closeAppUpdate = () => { appUpdateState.visible = false; };
let checking = false;
let lastChecked = 0;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const getInstalledApp = () => {
    if (typeof plus === 'undefined' || plus.os.name !== 'Android') return null;
    const activity = plus.android.runtimeMainActivity();
    plus.android.importClass(activity);
    const Build = plus.android.importClass('android.os.Build$VERSION');
    return { packageName: String(activity.getPackageName()), versionCode: Number(plus.runtime.versionCode), versionName: String(plus.runtime.version), sdkVersion: Number(Build.SDK_INT) };
};

export const checkAppVersion = () => new Promise((resolve, reject) => {
    let current;
    try { current = getInstalledApp(); } catch (error) { reject(error); return; }
    if (!current || !Number.isInteger(current.versionCode) || current.versionCode <= 0) { resolve(null); return; }
    const cached = uni.getStorageSync(APK_CACHE_KEY);
    if (cached?.versionCode && current.versionCode >= Number(cached.versionCode)) {
        removeAppApk(cached.filePath);
        uni.removeStorageSync(APK_CACHE_KEY);
    }
    uni.request({
        url: API_BASE_URL + '/api/app/check', method: 'GET', data: current, timeout: 3000,
        success: res => {
            if (res.statusCode !== 200 || res.data?.code !== 0) { reject(new Error(res.data?.message || '检查更新失败')); return; }
            const release = res.data.data?.release;
            if (res.data.data?.hasUpdate && release?.packageName === current.packageName && Number(release.versionCode) > current.versionCode) resolve(release);
            else resolve(null);
        },
        fail: () => reject(new Error('检查更新失败，请检查网络后重试')),
    });
});

export const checkAndOpenAppUpdate = async ({ source = 'background', manual = false } = {}) => {
    if (checking || getApp().globalData?.bluetoothOtaBusy) {
        if (manual) uni.showToast({ title: '正在执行其他任务，请稍后检查', icon: 'none', duration: 2000 });
        return false;
    }
    if (appUpdateState.visible) return true;
    if (!manual && source === 'background' && Date.now() - lastChecked < 6 * 60 * 60 * 1000) return false;
    checking = true;
    try {
        const release = await checkAppVersion();
        lastChecked = Date.now();
        if (getApp().globalData?.bluetoothOtaBusy) return false;
        if (!release) {
            if (manual) uni.showToast({ title: '当前已是最新版本', icon: 'none', duration: 2000 });
            return false;
        }
        const pages = getCurrentPages();
        const ownerRoute = pages[pages.length - 1]?.route;
        if (!ownerRoute) return false;
        Object.assign(appUpdateState, { visible: true, release, ownerRoute, source });
        return true;
    } catch (error) {
        if (manual) uni.showToast({ title: error.message || '检查更新失败', icon: 'none', duration: 2000 });
        console.info('[App更新] 检查未完成', { message: error.message || '无法检查更新' });
        return false;
    } finally { checking = false; }
};

export const getAppRelease = id => new Promise((resolve, reject) => uni.request({
    url: `${API_BASE_URL}/api/app/releases/${encodeURIComponent(id)}`, method: 'GET', timeout: 8000,
    success: res => {
        if (res.statusCode === 200 && res.data?.code === 0) resolve(res.data.data);
        else reject(new Error(res.data?.message || '版本已撤回或不存在'));
    },
    fail: () => reject(new Error('无法读取版本信息，请检查网络')),
}));

export const downloadAppApk = (release, onProgress, onTask) => new Promise((resolve, reject) => {
    const task = uni.downloadFile({
        url: `${API_BASE_URL}/api/app/releases/${encodeURIComponent(release.id)}/download`, timeout: 10 * 60 * 1000,
        success: result => {
            if (result.statusCode !== 200) { removeAppApk(result.tempFilePath); reject(new Error(`下载失败（HTTP ${result.statusCode}），请重新检查更新`)); return; }
            resolve(result.tempFilePath);
        },
        fail: () => reject(new Error('下载失败，请检查网络后重试')),
    });
    onTask(task);
    task.onProgressUpdate(result => onProgress(result.progress));
});

export const removeAppApk = filePath => {
    if (!filePath || typeof plus === 'undefined') return;
    plus.io.resolveLocalFileSystemURL(filePath, entry => entry.remove(() => {}, () => {}), () => {});
};

export const verifyAppApk = async (filePath, release, checkActive = () => {}, onProgress = () => {}) => {
    const current = getInstalledApp();
    if (!current || current.packageName !== release.packageName) throw new Error('安装包与当前 App 不匹配');
    if (!/^[a-f0-9]{64}$/i.test(release.sha256) || Number(release.fileSize) <= 0 || Number(release.fileSize) > 200 * 1024 * 1024) throw new Error('安装包信息无效，请重新检查更新');
    const localPath = plus.io.convertLocalFileSystemURL(filePath).replace(/^file:\/\//, '');
    const file = plus.android.newObject('java.io.File', localPath);
    plus.android.importClass(file);
    if (!file.isFile() || Number(file.length()) !== Number(release.fileSize)) throw new Error('安装包文件大小不匹配，请重新下载');
    const MessageDigest = plus.android.importClass('java.security.MessageDigest');
    const ReflectArray = plus.android.importClass('java.lang.reflect.Array');
    const Byte = plus.android.importClass('java.lang.Byte');
    const Base64 = plus.android.importClass('android.util.Base64');
    const digest = MessageDigest.getInstance('SHA-256');
    plus.android.importClass(digest);
    const stream = plus.android.newObject('java.io.FileInputStream', file);
    plus.android.importClass(stream);
    const buffer = ReflectArray.newInstance(Byte.TYPE, 64 * 1024);
    let consumed = 0;
    try {
        while (true) {
            checkActive();
            const count = Number(stream.read(buffer));
            if (count < 0) break;
            digest.update(buffer, 0, count);
            consumed += count;
            if (consumed % (2 * 1024 * 1024) < 64 * 1024) {
                onProgress(Math.min(100, Math.round(consumed / Number(release.fileSize) * 100)));
                await delay(0);
            }
        }
    } finally { stream.close(); }
    checkActive();
    const hash = Array.from(decodeBase64(String(Base64.encodeToString(digest.digest(), 2)))).map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (consumed !== Number(release.fileSize) || hash !== release.sha256.toLowerCase()) throw new Error('安装包校验失败，请重新下载');
    const activity = plus.android.runtimeMainActivity();
    plus.android.importClass(activity);
    const manager = activity.getPackageManager();
    plus.android.importClass(manager);
    const info = manager.getPackageArchiveInfo(localPath, 0);
    if (!info) throw new Error('无法识别 APK 安装包');
    plus.android.importClass(info);
    if (String(info.packageName) !== release.packageName || Number(info.versionCode) !== Number(release.versionCode)) throw new Error('APK 包名或版本与发布信息不一致');
    onProgress(100);
    return localPath;
};

export const requestApkInstallPermission = () => {
    const current = getInstalledApp();
    if (current.sdkVersion < 26) return true;
    const activity = plus.android.runtimeMainActivity();
    plus.android.importClass(activity);
    const manager = activity.getPackageManager();
    plus.android.importClass(manager);
    if (manager.canRequestPackageInstalls()) return true;
    const Uri = plus.android.importClass('android.net.Uri');
    const intent = plus.android.newObject('android.content.Intent', 'android.settings.MANAGE_UNKNOWN_APP_SOURCES', Uri.parse(`package:${current.packageName}`));
    activity.startActivity(intent);
    return false;
};
