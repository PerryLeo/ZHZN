import crypto from 'crypto';
import { inflateRawSync } from 'zlib';

const ensure = (condition, message = 'APK 文件结构无效') => { if (!condition) throw new Error(message); };
const slice = (buffer, start, length) => {
  ensure(Number.isSafeInteger(start) && Number.isSafeInteger(length) && start >= 0 && length >= 0 && start + length <= buffer.length);
  return buffer.subarray(start, start + length);
};
const lengthPrefixed = buffer => {
  let offset = 0;
  const result = [];
  while (offset < buffer.length) {
    const length = slice(buffer, offset, 4).readUInt32LE();
    offset += 4;
    result.push(slice(buffer, offset, length));
    offset += length;
  }
  return result;
};

const findZip = apk => {
  for (let offset = apk.length - 22; offset >= Math.max(0, apk.length - 65557); offset--) {
    if (apk.readUInt32LE(offset) !== 0x06054b50 || offset + 22 + apk.readUInt16LE(offset + 20) !== apk.length) continue;
    ensure(apk.readUInt16LE(offset + 4) === 0 && apk.readUInt16LE(offset + 6) === 0, '不支持分卷 APK');
    const centralOffset = apk.readUInt32LE(offset + 16);
    ensure(centralOffset + apk.readUInt32LE(offset + 12) === offset, 'APK ZIP 索引无效');
    return { centralOffset, eocdOffset: offset, count: apk.readUInt16LE(offset + 10) };
  }
  throw new Error('请选择有效的 APK 安装包');
};

const readManifest = (apk, zip) => {
  let offset = zip.centralOffset;
  let manifest = null;
  for (let index = 0; index < zip.count; index++) {
    const header = slice(apk, offset, 46);
    ensure(header.readUInt32LE() === 0x02014b50);
    const nameLength = header.readUInt16LE(28);
    const name = slice(apk, offset + 46, nameLength).toString('utf8');
    if (name === 'AndroidManifest.xml') {
      ensure(!manifest, 'APK 包含重复的 AndroidManifest.xml');
      const localOffset = header.readUInt32LE(42);
      const local = slice(apk, localOffset, 30);
      ensure(local.readUInt32LE() === 0x04034b50 && !(header.readUInt16LE(8) & 1));
      const dataOffset = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const compressed = slice(apk, dataOffset, header.readUInt32LE(20));
      ensure(header.readUInt32LE(24) <= 4 * 1024 * 1024, 'APK 清单过大');
      const method = header.readUInt16LE(10);
      ensure(method === 0 || method === 8, '不支持该 APK 压缩格式');
      manifest = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: 4 * 1024 * 1024 });
      ensure(manifest.length === header.readUInt32LE(24));
    }
    offset += 46 + nameLength + header.readUInt16LE(30) + header.readUInt16LE(32);
    ensure(offset <= zip.eocdOffset);
  }
  ensure(manifest, 'APK 缺少 AndroidManifest.xml');
  return parseManifest(manifest);
};

const parseManifest = buffer => {
  ensure(buffer.readUInt16LE(0) === 3 && buffer.readUInt32LE(4) === buffer.length, 'APK 清单不是有效的 Android 二进制 XML');
  let strings = [];
  const result = {};
  const stringAt = index => index === 0xffffffff ? '' : strings[index] ?? '';
  for (let offset = buffer.readUInt16LE(2); offset < buffer.length;) {
    const header = slice(buffer, offset, 8);
    const type = header.readUInt16LE();
    const headerSize = header.readUInt16LE(2);
    const size = header.readUInt32LE(4);
    ensure(size >= headerSize && headerSize >= 8);
    const chunk = slice(buffer, offset, size);
    if (type === 1) {
      ensure(headerSize >= 28);
      const count = chunk.readUInt32LE(8);
      ensure(count <= 100000 && headerSize + count * 4 <= chunk.length);
      const utf8 = !!(chunk.readUInt32LE(16) & 0x100);
      const start = chunk.readUInt32LE(20);
      strings = [];
      for (let index = 0; index < count; index++) {
        let position = start + chunk.readUInt32LE(headerSize + index * 4);
        const readLength = () => {
          const first = slice(chunk, position, utf8 ? 1 : 2)[utf8 ? 'readUInt8' : 'readUInt16LE']();
          position += utf8 ? 1 : 2;
          if (!(first & (utf8 ? 0x80 : 0x8000))) return first;
          const second = slice(chunk, position, utf8 ? 1 : 2)[utf8 ? 'readUInt8' : 'readUInt16LE']();
          position += utf8 ? 1 : 2;
          return utf8 ? ((first & 0x7f) << 8) | second : (first & 0x7fff) * 65536 + second;
        };
        let length = readLength();
        if (utf8) length = readLength();
        strings.push(slice(chunk, position, length * (utf8 ? 1 : 2)).toString(utf8 ? 'utf8' : 'utf16le'));
      }
    } else if (type === 0x0102) {
      ensure(headerSize >= 16 && chunk.length >= headerSize + 20);
      const tag = stringAt(chunk.readUInt32LE(headerSize + 4));
      const attrStart = chunk.readUInt16LE(headerSize + 8) + headerSize;
      const attrSize = chunk.readUInt16LE(headerSize + 10);
      const count = chunk.readUInt16LE(headerSize + 12);
      ensure(attrSize >= 20);
      for (let index = 0; index < count; index++) {
        const attr = slice(chunk, attrStart + index * attrSize, attrSize);
        const name = stringAt(attr.readUInt32LE(4));
        const raw = attr.readUInt32LE(8);
        const value = raw !== 0xffffffff ? stringAt(raw) : attr[15] === 3 ? stringAt(attr.readUInt32LE(16)) : attr.readUInt32LE(16);
        if (tag === 'manifest' && ['package', 'versionCode', 'versionName'].includes(name)) result[name === 'package' ? 'packageName' : name] = value;
        if (tag === 'uses-sdk' && name === 'minSdkVersion') result.minSdkVersion = Number(value);
      }
    }
    offset += size;
  }
  result.versionCode = Number(result.versionCode);
  ensure(/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/.test(result.packageName || ''), 'APK 包名无效');
  ensure(Number.isInteger(result.versionCode) && result.versionCode > 0 && result.versionCode <= 2100000000, 'APK versionCode 无效');
  ensure(typeof result.versionName === 'string' && result.versionName.length > 0 && result.versionName.length <= 100, 'APK 缺少版本名称');
  return result;
};

const algorithms = {
  0x0101: { hash: 'sha256', padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
  0x0102: { hash: 'sha512', padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 },
  0x0103: { hash: 'sha256', padding: crypto.constants.RSA_PKCS1_PADDING },
  0x0104: { hash: 'sha512', padding: crypto.constants.RSA_PKCS1_PADDING },
  0x0201: { hash: 'sha256' }, 0x0202: { hash: 'sha512' }, 0x0301: { hash: 'sha256' },
};

const contentDigest = (apk, zip, blockStart, hash) => {
  const eocd = Buffer.from(apk.subarray(zip.eocdOffset));
  eocd.writeUInt32LE(blockStart, 16);
  const digests = [];
  for (const section of [apk.subarray(0, blockStart), apk.subarray(zip.centralOffset, zip.eocdOffset), eocd]) {
    for (let offset = 0; offset < section.length; offset += 1024 * 1024) {
      const chunk = section.subarray(offset, Math.min(offset + 1024 * 1024, section.length));
      const prefix = Buffer.alloc(5); prefix[0] = 0xa5; prefix.writeUInt32LE(chunk.length, 1);
      digests.push(crypto.createHash(hash).update(prefix).update(chunk).digest());
    }
  }
  const prefix = Buffer.alloc(5); prefix[0] = 0x5a; prefix.writeUInt32LE(digests.length, 1);
  return crypto.createHash(hash).update(prefix).update(Buffer.concat(digests)).digest();
};

const verifyV2 = (apk, zip) => {
  const footer = slice(apk, zip.centralOffset - 24, 24);
  ensure(footer.subarray(8).toString() === 'APK Sig Block 42', 'APK 必须包含有效的 v2 签名，请使用正式证书重新打包');
  const size = Number(footer.readBigUInt64LE());
  const start = zip.centralOffset - size - 8;
  const block = slice(apk, start, size + 8);
  ensure(Number(block.readBigUInt64LE()) === size);
  let v2 = null;
  for (let offset = 8; offset < block.length - 24;) {
    const length = Number(slice(block, offset, 8).readBigUInt64LE());
    ensure(length >= 4);
    const entry = slice(block, offset + 8, length);
    if (entry.readUInt32LE() === 0x7109871a) { ensure(!v2, 'APK 签名块重复'); v2 = entry.subarray(4); }
    offset += length + 8;
    ensure(offset <= block.length - 24);
  }
  ensure(v2, 'APK 必须包含 v2 签名；当前不接收仅 v1 或仅 v3 签名的安装包');
  const signers = lengthPrefixed(lengthPrefixed(v2)[0]);
  ensure(signers.length > 0 && signers.length <= 10);
  const certificates = [];
  const cachedDigests = {};
  for (const signer of signers) {
    const parts = lengthPrefixed(signer);
    ensure(parts.length === 3);
    const signedData = parts[0];
    const signedParts = lengthPrefixed(signedData);
    // 部分签名工具会在 signed data 后附加对齐字段，仍在签名保护范围内。
    ensure(signedParts.length >= 3);
    const signatures = lengthPrefixed(parts[1]);
    const digestRecords = lengthPrefixed(signedParts[0]);
    const algorithmIds = signatures.map(record => slice(record, 0, 4).readUInt32LE());
    ensure(JSON.stringify(algorithmIds) === JSON.stringify(digestRecords.map(record => slice(record, 0, 4).readUInt32LE())), 'APK 签名算法与摘要不一致');
    const supported = signatures.filter(record => algorithms[record.readUInt32LE()]);
    ensure(supported.length > 0, '不支持该 APK 签名算法');
    const record = supported.sort((a, b) => (algorithms[b.readUInt32LE()].hash === 'sha512' ? 1 : 0) - (algorithms[a.readUInt32LE()].hash === 'sha512' ? 1 : 0))[0];
    const id = record.readUInt32LE();
    const algorithm = algorithms[id];
    const signature = lengthPrefixed(record.subarray(4));
    ensure(signature.length === 1);
    const certs = lengthPrefixed(signedParts[1]);
    ensure(certs.length > 0);
    const certificate = new crypto.X509Certificate(certs[0]);
    ensure(certificate.publicKey.export({ type: 'spki', format: 'der' }).equals(parts[2]), 'APK 公钥与签名证书不一致');
    ensure(crypto.verify(algorithm.hash, signedData, { key: certificate.publicKey, ...algorithm }, signature[0]), 'APK 签名校验失败');
    const storedDigest = lengthPrefixed(digestRecords.find(item => item.readUInt32LE() === id).subarray(4));
    ensure(storedDigest.length === 1);
    cachedDigests[algorithm.hash] ||= contentDigest(apk, zip, start, algorithm.hash);
    ensure(cachedDigests[algorithm.hash].equals(storedDigest[0]), 'APK 内容被修改，签名摘要校验失败');
    certificates.push(crypto.createHash('sha256').update(certs[0]).digest('hex'));
  }
  return certificates.sort().join(',');
};

export const inspectApk = apk => {
  ensure(Buffer.isBuffer(apk) && apk.length >= 100 && apk.readUInt32LE() === 0x04034b50, '请选择有效的 APK 文件');
  const zip = findZip(apk);
  const certificateSha256 = verifyV2(apk, zip);
  return { ...readManifest(apk, zip), certificateSha256 };
};
