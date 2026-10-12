import { API_BASE_URL } from './config.js';
import { decodeBase64, encodeBase64 } from './otaProtocol.js';

export const getBluetoothOtaSocket = () => {
    if (typeof plus === 'undefined' || plus.os.name !== 'Android') throw new Error('蓝牙升级需在 Android App 中使用');
    const socket = getApp().globalData?.sppSocket;
    if (!socket || !socket.isConnected()) throw new Error('蓝牙未连接，请先连接设备');
    return socket;
};

export const downloadBluetoothFirmware = (file, onProgress, onTask) => new Promise((resolve, reject) => {
    const expectedPath = `/api/ota/bluetooth/firmwares/${encodeURIComponent(file.firmwareFile)}/download`;
    // 固件下载只使用配置的 API 服务，避免将接口返回的任意 URL 作为下载源。
    const task = uni.downloadFile({
        url: API_BASE_URL + expectedPath,
        timeout: 120000,
        success: result => {
            if (result.statusCode !== 200) {
                removeFirmwareFile(result.tempFilePath);
                reject(new Error(`固件下载失败（HTTP ${result.statusCode}）`));
                return;
            }
            resolve(result.tempFilePath);
        },
        fail: () => reject(new Error('固件下载失败，请检查网络后重试')),
    });
    onTask(task);
    task.onProgressUpdate(result => onProgress(result.progress));
});

export const removeFirmwareFile = filePath => {
    if (!filePath || typeof plus === 'undefined') return;
    plus.io.resolveLocalFileSystemURL(filePath, entry => entry.remove(() => {}, () => {}), () => {});
};

export const readVerifiedFirmware = (filePath, metadata) => new Promise((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(filePath, entry => {
        entry.file(file => {
            if (file.size !== Number(metadata.firmwareSize) || file.size <= 0 || file.size > 10 * 1024 * 1024) {
                reject(new Error('固件大小不匹配或超过 10 MB，请重新选择固件'));
                return;
            }
            const reader = new plus.io.FileReader();
            reader.onerror = () => reject(new Error('读取固件失败'));
            reader.onload = event => {
                try {
                    const dataUrl = String(event.target.result);
                    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
                    const bytes = decodeBase64(base64);
                    if (bytes.length !== Number(metadata.firmwareSize)) throw new Error('固件内容长度不匹配');
                    const Base64 = plus.android.importClass('android.util.Base64');
                    const MessageDigest = plus.android.importClass('java.security.MessageDigest');
                    const digest = MessageDigest.getInstance('SHA-256');
                    plus.android.importClass(digest);
                    const nativeBytes = Base64.decode(base64, 0);
                    const hashBytes = decodeBase64(String(Base64.encodeToString(digest.digest(nativeBytes), 2)));
                    const hash = Array.from(hashBytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
                    if (hash !== String(metadata.firmwareSha256).toLowerCase()) throw new Error('固件 SHA-256 校验失败，请刷新列表后重试');
                    resolve(bytes);
                } catch (error) { reject(error); }
            };
            reader.readAsDataURL(file);
        }, () => reject(new Error('无法打开固件文件')));
    }, () => reject(new Error('找不到下载的固件文件')));
});

// SPP 是字节流：累积拆分应答，按换行解析；无换行时等待短暂静默后匹配。
export const createBluetoothOtaTransport = socket => {
    const input = socket.getInputStream();
    const output = socket.getOutputStream();
    plus.android.importClass(input);
    plus.android.importClass(output);
    const Base64 = plus.android.importClass('android.util.Base64');
    let waiter = null;
    let buffer = '';
    let lastReadAt = 0;
    let closed = false;

    const finish = (error, line) => {
        if (!waiter) return;
        const pending = waiter;
        waiter = null;
        clearTimeout(pending.timer);
        error ? pending.reject(error) : pending.resolve(line);
    };
    const consume = line => {
        const value = line.trim();
        if (!waiter || !value) return;
        if (value.startsWith('OTA:ERR:')) finish(new Error(`设备升级失败：${value}`));
        else if (waiter.matcher(value)) finish(null, value);
    };
    const timer = setInterval(() => {
        try {
            if (!socket.isConnected()) throw new Error('蓝牙连接已断开，请重新连接后确认设备状态');
            const available = Math.min(input.available(), 4096);
            if (available > 0) {
                for (let i = 0; i < available; i++) {
                    const byte = input.read();
                    if (byte === -1) throw new Error('蓝牙连接已断开');
                    buffer += String.fromCharCode(byte);
                }
                lastReadAt = Date.now();
                let newline = buffer.indexOf('\n');
                while (newline >= 0) {
                    consume(buffer.slice(0, newline));
                    buffer = buffer.slice(newline + 1);
                    newline = buffer.indexOf('\n');
                }
                if (buffer.length > 8192) throw new Error('设备应答格式异常');
            } else if (buffer && Date.now() - lastReadAt >= 100) {
                consume(buffer);
                buffer = '';
            }
        } catch (error) {
            closed = true;
            clearInterval(timer);
            finish(error);
        }
    }, 40);
    const write = bytes => {
        if (closed || !socket.isConnected()) throw new Error('蓝牙连接已断开');
        // 必须使用 byte[]，不能把固件转成 ASCII 字符串。
        output.write(Base64.decode(encodeBase64(bytes), 0));
        output.flush();
    };
    return {
        write,
        exchange(bytes, matcher, timeout) {
            if (waiter) return Promise.reject(new Error('仍有未完成的设备应答'));
            return new Promise((resolve, reject) => {
                buffer = '';
                waiter = { resolve, reject, matcher, timer: setTimeout(() => {
                    const error = new Error('等待设备升级应答超时');
                    error.code = 'OTA_TIMEOUT';
                    finish(error);
                }, timeout) };
                try { write(bytes); } catch (error) { finish(error); }
            });
        },
        close() {
            closed = true;
            clearInterval(timer);
            finish(new Error('蓝牙升级已停止'));
        },
    };
};
