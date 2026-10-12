import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { ref, computed } from 'vue';

// 执行页面实际的 setup 逻辑，隔离网络和生命周期；不访问线上固件。
const source = await fs.readFile(new URL('../src/views/OtaView.vue', import.meta.url), 'utf8');
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm, '');
const createPage = new Function('ref', 'computed', 'inject', 'onMounted', 'onUnmounted', 'watch', 'api', 'formatTime', 'showToast', `${script}
return { firmwares, firmwareFile, preview, uploadedFirmware, deleteConfirmVisible, firmwareToDelete, deletingFirmware, confirmDeleteFirmware, deleteFirmware };
`);
const setup = (deleteRequest) => {
  const toasts = [];
  const page = createPage(ref, computed, () => null, () => {}, () => {}, () => {}, { delete: deleteRequest }, value => value, (...args) => toasts.push(args));
  page.firmwares.value = [
    { firmwareFile: 'old version.pkg', firmwareVersion: 'old' },
    { firmwareFile: 'new.pkg', firmwareVersion: 'new' },
  ];
  page.firmwareFile.value = 'old version.pkg';
  page.preview.value = { firmware: page.firmwares.value[0] };
  return { page, toasts };
};

test('successful deletion removes only confirmed firmware, clears selection and preview', async () => {
  const calls = [];
  const { page, toasts } = setup(async url => { calls.push(url); });
  page.uploadedFirmware.value = page.firmwares.value[0];
  page.confirmDeleteFirmware();
  assert.equal(page.deleteConfirmVisible.value, true);
  await page.deleteFirmware();
  assert.deepEqual(calls, ['/api/ota/firmwares/old%20version.pkg']);
  assert.deepEqual(page.firmwares.value.map(file => file.firmwareFile), ['new.pkg']);
  assert.equal(page.firmwareFile.value, '');
  assert.equal(page.preview.value, null);
  assert.equal(page.uploadedFirmware.value, null);
  assert.equal(page.deleteConfirmVisible.value, false);
  assert.equal(page.deletingFirmware.value, false);
  assert.equal(toasts[0][0], '固件已删除');
});

test('server rejection keeps firmware and selection and displays error', async () => {
  const { page, toasts } = setup(async () => { throw new Error('固件正在使用'); });
  page.confirmDeleteFirmware();
  await page.deleteFirmware();
  assert.equal(page.firmwares.value.length, 2);
  assert.equal(page.firmwareFile.value, 'old version.pkg');
  assert.equal(page.deleteConfirmVisible.value, true);
  assert.equal(page.deletingFirmware.value, false);
  assert.deepEqual(toasts[0], ['固件正在使用', 'error']);
});

test('confirmation retains its filename if selection changes', async () => {
  const calls = [];
  const { page } = setup(async url => { calls.push(url); });
  page.confirmDeleteFirmware();
  page.firmwareFile.value = 'new.pkg';
  await page.deleteFirmware();
  assert.deepEqual(calls, ['/api/ota/firmwares/old%20version.pkg']);
  assert.equal(page.firmwareFile.value, 'new.pkg');
});

test('repeated confirmation while request is pending sends only one delete', async () => {
  let release;
  let calls = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const { page } = setup(() => { calls += 1; return pending; });
  page.confirmDeleteFirmware();
  const deletion = page.deleteFirmware();
  assert.equal(page.deletingFirmware.value, true);
  await page.deleteFirmware();
  assert.equal(calls, 1);
  release();
  await deletion;
  assert.equal(page.deletingFirmware.value, false);
});
