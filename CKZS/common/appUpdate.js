import { reactive } from 'vue';
import { API_BASE_URL } from './config.js';
import { decodeBase64 } from './otaProtocol.js';

export const APK_CACHE_KEY = 'APP_UPDATE_APK';
export const appUpdateState = reactive({ visible: false, release: null, ownerRoute: '', source: 'background' });
export const closeAppUpdate = () => { appUpdateState.visible = false; };
let checking = false;
let lastChecked = 0;
let retryTimer = null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const logUpdate = (message, details) => console.info(`[App更新] ${message} ${JSON.stringify(details)}`);
const checkError = (message, details = {}) => Object.assign(new Error(message), details);

const retryAfterStartup = (remaining = 20) => {
    if (retryTimer || !remaining) return;
    retryTimer = setTimeout(() => {
        retryTimer = null;
        if (appUpdateState.visible) return;
        const pages = getCurrentPages();
        const route = pages[pages.length - 1]?.route;
        // 登录状态检查和 reLaunch 完成后，弹窗才挂在用户实际停留的页面。
        if (!route || route === 'pages/launch/index' || checking || getApp().globalData?.bluetoothOtaBusy) {
            retryAfterStartup(remaining - 1);
            return;
        }
        checkAndOpenAppUpdate({ source: 'startup-retry' });
    }, 1500);
};

export const getInstalledApp = () => {
    if (typeof plus === 'undefined' || plus.os.name !== 'Android') return null;
    const activity = plus.android.runtimeMainActivity();
    plus.android.importClass(activity);
    const Build = plus.android.importClass('android.os.Build$VERSION');
    return { packageName: String(activity.getPackageName()), versionCode: Number(plus.runtime.versionCode), versionName: String(plus.runtime.version), sdkVersion: Number(Build.SDK_INT) };
};

export const checkAppVersion = ({ timeout = 8000 } = {}) => new Promise((resolve, reject) => {
    let current;
    try { current = getInstalledApp(); } catch (error) { reject(error); return; }
    if (!current) { resolve(null); return; }
    if (!Number.isInteger(current.versionCode) || current.versionCode <= 0) {
        reject(checkError('无法读取当前安装包版本号', { reason: 'invalid-version', current })); return;
    }
    const url = API_BASE_URL + '/api/app/check';
    logUpdate('开始检查', { ...current, url, timeout });
    if (/^(io\.dcloud\.HBuilder|io\.dcloud\.uniapp)(\.|$)/i.test(current.packageName)) {
        logUpdate('当前为调试基座，请用同包名的正式 APK 验证覆盖更新', { packageName: current.packageName, versionCode: current.versionCode });
    }
    const cached = uni.getStorageSync(APK_CACHE_KEY);
    if (cached?.versionCode && current.versionCode >= Number(cached.versionCode)) {
        removeAppApk(cached.filePath);
        uni.removeStorageSync(APK_CACHE_KEY);
    }
    uni.request({
        url, method: 'GET', data: current, timeout,
        success: res => {
            if (res.statusCode !== 200 || res.data?.code !== 0) {
                reject(checkError(res.data?.message || `检查更新失败（HTTP ${res.statusCode}）`, { reason: 'response', statusCode: res.statusCode, apiCode: res.data?.code, url })); return;
            }
            const release = res.data.data?.release;
            logUpdate('检查结果', { current, hasUpdate: res.data.data?.hasUpdate, latest: release ? { packageName: release.packageName, versionCode: release.versionCode, forceUpdate: release.forceUpdate } : null });
            if (typeof res.data.data?.hasUpdate !== 'boolean') {
                reject(checkError('更新接口返回的数据格式不正确', { reason: 'response-format' })); return;
            }
            if (!res.data.data.hasUpdate) { resolve(null); return; }
            if (!release?.id || release.packageName !== current.packageName || !Number.isInteger(Number(release.versionCode)) || Number(release.versionCode) <= current.versionCode) {
                reject(checkError('发布信息与当前安装包不匹配', { reason: 'release-mismatch', current })); return;
            }
            resolve(release);
        },
        fail: error => {
            const errMsg = String(error.errMsg || 'request:fail');
            const timedOut = /timeout|超时/i.test(errMsg);
            reject(checkError(timedOut ? '检查更新超时，请稍后重试' : '无法连接更新服务，请检查网络', { reason: 'network', errMsg, errCode: error.errCode, url, timeout }));
        },
    });
});

export const checkAndOpenAppUpdate = async ({ source = 'background', manual = false } = {}) => {
    if (checking || getApp().globalData?.bluetoothOtaBusy) {
        if (manual) uni.showToast({ title: '正在执行其他任务，请稍后检查', icon: 'none', duration: 2000 });
        return false;
    }
    if (appUpdateState.visible) return true;
    if (!manual && source === 'background' && Date.now() - lastChecked < 6 * 60 * 60 * 1000) {
        logUpdate('跳过重复前台检查', { reason: 'recent-success', lastChecked });
        return false;
    }
    checking = true;
    try {
        const release = await checkAppVersion({ timeout: source === 'startup' ? 3000 : 8000 });
        lastChecked = Date.now();
        if (getApp().globalData?.bluetoothOtaBusy) return false;
        if (!release) {
            if (manual) uni.showToast({ title: '当前已是最新版本', icon: 'none', duration: 2000 });
            return false;
        }
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        const pages = getCurrentPages();
        const ownerRoute = pages[pages.length - 1]?.route;
        if (!ownerRoute) return false;
        Object.assign(appUpdateState, { visible: true, release, ownerRoute, source });
        logUpdate('打开更新弹窗', { ownerRoute, source, versionCode: release.versionCode });
        return true;
    } catch (error) {
        if (manual) uni.showToast({ title: error.message || '检查更新失败', icon: 'none', duration: 2000 });
        logUpdate('检查未完成', { source, message: error.message || '无法检查更新', reason: error.reason, errMsg: error.errMsg, errCode: error.errCode, statusCode: error.statusCode, apiCode: error.apiCode, url: error.url, timeout: error.timeout });
        if (source === 'startup' && error.reason === 'network') retryAfterStartup();
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
    const startedAt = Date.now();
    let lastProgressAt = startedAt, lastBytes = 0, bytesPerSecond = 0;
    const task = uni.downloadFile({
        url: `${API_BASE_URL}/api/app/releases/${encodeURIComponent(release.id)}/download`, timeout: 10 * 60 * 1000,
        success: result => {
            logUpdate('下载安装包完成', { id: release.id, statusCode: result.statusCode, fileSize: release.fileSize, elapsedMs: Date.now() - startedAt });
            if (result.statusCode !== 200) { removeAppApk(result.tempFilePath); reject(new Error(`下载失败（HTTP ${result.statusCode}），请重新检查更新`)); return; }
            resolve(result.tempFilePath);
        },
        fail: error => {
            logUpdate('下载安装包失败', { id: release.id, elapsedMs: Date.now() - startedAt, errMsg: error.errMsg });
            reject(new Error('下载失败，请检查网络后重试'));
        },
    });
    onTask(task);
    task.onProgressUpdate(result => {
        const now = Date.now(), written = Number(result.totalBytesWritten);
        if (Number.isFinite(written) && now - lastProgressAt >= 1000) {
            bytesPerSecond = Math.max(0, (written - lastBytes) * 1000 / (now - lastProgressAt));
            lastBytes = written; lastProgressAt = now;
        }
        onProgress(result.progress, bytesPerSecond);
    });
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
    const expectedSize = Number(release.fileSize);
    const actualSize = Number(file.length());
    if (!file.isFile() || actualSize !== expectedSize) {
        logUpdate('安装包大小不匹配', { id: release.id, expectedSize, actualSize });
        throw Object.assign(new Error('安装包文件大小不匹配，请重新下载'), { discardApk: true });
    }
    const MessageDigest = plus.android.importClass('java.security.MessageDigest');
    const ReflectArray = plus.android.importClass('java.lang.reflect.Array');
    const Byte = plus.android.importClass('java.lang.Byte');
    const Base64 = plus.android.importClass('android.util.Base64');
    const digest = MessageDigest.getInstance('SHA-256');
    plus.android.importClass(digest);
    const input = plus.android.newObject('java.io.FileInputStream', file);
    let stream;
    try {
        // 由 Java 在读取时更新摘要，避免 read 和 update 之间跨桥传递可变 byte[]。
        stream = plus.android.newObject('java.security.DigestInputStream', input, digest);
    } catch (error) {
        plus.android.invoke(input, 'close');
        throw error;
    }
    plus.android.importClass(stream);
    const buffer = ReflectArray.newInstance(Byte.TYPE, 64 * 1024);
    let consumed = 0;
    try {
        while (true) {
            checkActive();
            const count = Number(stream.read(buffer));
            if (count < 0) break;
            if (!Number.isInteger(count) || count <= 0 || count > 64 * 1024) throw new Error('无法读取安装包，请重新下载');
            consumed += count;
            if (consumed % (2 * 1024 * 1024) < 64 * 1024) {
                onProgress(Math.min(100, Math.round(consumed / Number(release.fileSize) * 100)));
                await delay(0);
            }
        }
    } finally { stream.close(); }
    checkActive();
    const hash = Array.from(decodeBase64(String(Base64.encodeToString(digest.digest(), 2)))).map(byte => byte.toString(16).padStart(2, '0')).join('');
    const expectedHash = release.sha256.toLowerCase();
    logUpdate('安装包摘要校验', { id: release.id, expectedSize, actualSize, consumed, expectedHash, actualHash: hash, matched: consumed === expectedSize && hash === expectedHash });
    if (consumed !== expectedSize || hash !== expectedHash) throw Object.assign(new Error('安装包内容校验失败，请重新下载'), { discardApk: true });
    const activity = plus.android.runtimeMainActivity();
    plus.android.importClass(activity);
    const manager = activity.getPackageManager();
    plus.android.importClass(manager);
    const info = manager.getPackageArchiveInfo(localPath, 0);
    if (!info) throw new Error('无法识别 APK 安装包');
    // PackageInfo 是 Java 实例，字段通过 Native.js 属性接口读取，不能依赖 JS 对象属性。
    const rawPackageName = plus.android.getAttribute(info, 'packageName');
    const rawVersionCode = plus.android.getAttribute(info, 'versionCode');
    const actualPackageName = rawPackageName == null ? '' : String(rawPackageName);
    const actualVersionCode = rawVersionCode == null ? NaN : Number(rawVersionCode);
    logUpdate('APK 包信息校验', { id: release.id, expectedPackageName: release.packageName, actualPackageName, expectedVersionCode: release.versionCode, actualVersionCode: Number.isFinite(actualVersionCode) ? actualVersionCode : null });
    if (!actualPackageName || !Number.isInteger(actualVersionCode) || actualVersionCode <= 0) {
        throw new Error('无法读取 APK 包名或版本，安装包已保留，请重试校验');
    }
    if (actualPackageName !== release.packageName || actualVersionCode !== Number(release.versionCode)) {
        throw Object.assign(new Error('APK 包名或版本与发布信息不一致'), { discardApk: true });
    }
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
