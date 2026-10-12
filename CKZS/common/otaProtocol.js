// 与服务端 ota.service.js 使用相同的帧格式和 CRC16-CCITT。
export const crc16Ccitt = (bytes, initial = 0xFFFF) => {
    let crc = initial;
    for (const byte of bytes) {
        crc ^= byte << 8;
        for (let bit = 0; bit < 8; bit++) {
            crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
        }
    }
    return crc;
};

export const buildOtaFrame = (type, offset = 0, payload = new Uint8Array(0)) => {
    const frame = new Uint8Array(11 + payload.length);
    const view = new DataView(frame.buffer);
    view.setUint16(0, 0xAA55, false);
    view.setUint8(2, type);
    view.setUint32(3, offset, true);
    view.setUint16(7, payload.length, true);
    frame.set(payload, 9);
    view.setUint16(frame.length - 2, crc16Ccitt(frame.subarray(2, frame.length - 2)), true);
    return frame;
};

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export const encodeBase64 = bytes => {
    let result = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const value = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
        result += alphabet[(value >>> 18) & 63] + alphabet[(value >>> 12) & 63]
            + (i + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : '=')
            + (i + 2 < bytes.length ? alphabet[value & 63] : '=');
    }
    return result;
};

export const decodeBase64 = value => {
    const input = value.replace(/\s/g, '');
    if (!input || input.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) throw new Error('固件文件编码无效');
    const padding = input.endsWith('==') ? 2 : input.endsWith('=') ? 1 : 0;
    const bytes = new Uint8Array(input.length / 4 * 3 - padding);
    let index = 0;
    for (let i = 0; i < input.length; i += 4) {
        const value = (alphabet.indexOf(input[i]) << 18) | (alphabet.indexOf(input[i + 1]) << 12)
            | ((alphabet.indexOf(input[i + 2]) & 63) << 6) | (alphabet.indexOf(input[i + 3]) & 63);
        if (index < bytes.length) bytes[index++] = (value >>> 16) & 255;
        if (index < bytes.length) bytes[index++] = (value >>> 8) & 255;
        if (index < bytes.length) bytes[index++] = value & 255;
    }
    return bytes;
};

const commandBytes = command => Uint8Array.from(command.split('').map(char => char.charCodeAt(0)));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const transferBluetoothFirmware = async ({ firmware, transport, onProgress = () => {}, checkActive = () => {}, settle = delay }) => {
    const exchange = async (bytes, matcher, timeout) => {
        checkActive();
        return transport.exchange(bytes, matcher, timeout);
    };
    onProgress({ stage: 'starting', progress: 0, message: '正在进入设备升级模式' });
    await exchange(commandBytes('$F\n'), line => /^ok/i.test(line), 5000);
    await settle(500);
    const begin = new Uint8Array(6);
    const view = new DataView(begin.buffer);
    view.setUint32(0, firmware.length, true);
    view.setUint16(4, crc16Ccitt(firmware), true);
    let begun = false;
    for (let attempt = 0; attempt < 2 && !begun; attempt++) {
        try {
            const response = await exchange(buildOtaFrame(1, 0, begin), line => /^OTA:(ACK|RETRY):0$/.test(line), 8000);
            begun = response === 'OTA:ACK:0';
        } catch (error) {
            if (error.code !== 'OTA_TIMEOUT' || attempt === 1) throw error;
        }
    }
    if (!begun) throw new Error('设备未接受固件初始化，请确认固件与设备匹配');

    let offset = 0;
    let failures = 0;
    let totalRetries = 0;
    let highWater = 0;
    while (offset < firmware.length) {
        checkActive();
        const chunk = firmware.subarray(offset, Math.min(offset + 1024, firmware.length));
        const expected = offset + chunk.length;
        let response;
        try {
            response = await exchange(buildOtaFrame(2, offset, chunk), line => line === `OTA:ACK:${expected}` || /^OTA:RETRY:\d+$/.test(line), 5000);
        } catch (error) {
            if (error.code !== 'OTA_TIMEOUT') throw error;
            response = '';
        }
        if (response === `OTA:ACK:${expected}`) {
            offset = expected;
            if (offset > highWater) {
                highWater = offset;
                failures = 0;
            } else if (++failures >= 3) {
                throw new Error('设备重复要求重传，升级未取得进展');
            }
            onProgress({ stage: 'transferring', progress: Number((offset / firmware.length * 100).toFixed(1)), message: '正在通过蓝牙传输固件' });
        } else {
            if (++failures >= 3 || ++totalRetries > 30) throw new Error(`固件传输多次失败（偏移 ${offset}），请重新连接后重试`);
            if (response) {
                const requestedOffset = Number(response.split(':')[2]);
                if (!Number.isInteger(requestedOffset) || requestedOffset < 0 || requestedOffset > offset) throw new Error('设备返回了无效的重传偏移');
                offset = requestedOffset;
            }
            onProgress({ stage: 'transferring', progress: Number((offset / firmware.length * 100).toFixed(1)), message: '设备未确认数据，正在重传' });
        }
    }
    onProgress({ stage: 'verifying', progress: 100, message: '固件已传输，正在等待设备校验' });
    await exchange(buildOtaFrame(3, firmware.length), line => line === 'OTA:READY', 15000);
    checkActive();
    await transport.write(commandBytes('$G\n'));
    onProgress({ stage: 'rebooting', progress: 100, message: '重启指令已发送，请重新连接并确认设备版本' });
};
