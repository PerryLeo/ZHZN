<template>
  <div class="ota-view">
    <div class="ota-tabs" role="tablist" aria-label="OTA页面">
      <button :class="{ active: section === 'create' }" type="button" @click="section = 'create'">发起更新</button>
      <button :class="{ active: section === 'history' }" type="button" @click="openHistory">任务记录</button>
    </div>

    <template v-if="section === 'create'">
      <section class="panel ota-panel">
        <div class="panel-header"><div><h2>上传新固件</h2><p>选择新的 .pkg 文件，确认后覆盖服务器上的 lobster-feeder.pkg</p></div><span class="role-tag">最大 10 MB</span></div>
        <div class="ota-panel-body">
          <div class="upload-control">
            <input ref="firmwareInput" type="file" accept=".pkg,application/octet-stream" :disabled="uploadingFirmware" @change="inspectFirmwareFile">
            <span class="upload-hint">文件仅在点击确认后上传；上传前会显示本地识别到的版本</span>
          </div>
          <div v-if="uploadCandidate" class="firmware-meta upload-meta">
            <div><span>选择文件</span><strong>{{ uploadCandidate.name }}</strong></div>
            <div><span>识别版本</span><strong>{{ uploadCandidate.version || '未识别版本' }}</strong></div>
            <div><span>文件大小</span><strong>{{ formatBytes(uploadCandidate.size) }}</strong></div>
          </div>
          <div class="ota-actions upload-actions">
            <button class="primary-btn" type="button" :disabled="!uploadCandidate || uploadingFirmware" @click="uploadConfirmVisible = true">确认并覆盖服务器固件</button>
          </div>
          <div v-if="uploadedFirmware" class="upload-success">已更新服务器固件：{{ uploadedFirmware.firmwareFile }} · {{ uploadedFirmware.firmwareVersion || '版本未识别' }} · {{ formatBytes(uploadedFirmware.firmwareSize) }}</div>
        </div>
      </section>

      <section class="panel ota-panel">
        <div class="panel-header"><div><h2>选择固件</h2><p>固件由服务器维护，选择已放入 OTA 固件目录的文件</p></div><span class="role-tag">支持 .bin / .pkg</span></div>
        <div class="ota-panel-body">
          <div class="form-field">
            <label for="ota-firmware">固件文件</label>
            <select id="ota-firmware" v-model="firmwareFile" class="form-control" @change="clearPreview">
              <option value="">请选择固件</option>
              <option v-for="firmware in firmwares" :key="firmware.firmwareFile" :value="firmware.firmwareFile">
                {{ firmware.firmwareVersion || '未识别版本' }} · {{ firmware.firmwareFile }}
              </option>
            </select>
          </div>
          <div v-if="selectedFirmware" class="firmware-meta">
            <div><span>固件版本</span><strong>{{ selectedFirmware.firmwareVersion || '未识别' }}</strong></div>
            <div><span>文件大小</span><strong>{{ formatBytes(selectedFirmware.firmwareSize) }}</strong></div>
            <div><span>SHA-256</span><strong class="hash-value">{{ selectedFirmware.firmwareSha256 }}</strong></div>
          </div>
          <div v-if="!firmwares.length && !loadingFirmwares" class="ota-inline-notice">服务器固件目录中没有可用的 .bin 或 .pkg 文件。</div>
        </div>
      </section>

      <section class="panel ota-panel">
        <div class="panel-header"><div><h2>选择升级范围</h2><p>设备必须已绑定且在线；离线设备会列入跳过结果</p></div></div>
        <div class="ota-panel-body">
          <div class="scope-cards">
            <button v-for="item in scopes" :key="item.key" type="button" class="scope-card" :class="{ active: scope === item.key }" @click="selectScope(item.key)">
              <span class="scope-radio"><i></i></span><strong>{{ item.title }}</strong><small>{{ item.description }}</small>
            </button>
          </div>

          <div v-if="scope === 'user'" class="target-picker">
            <div class="form-field"><label for="ota-user">目标用户</label><select id="ota-user" v-model="targetUserId" class="form-control" @change="loadUserDevices"><option value="">请选择用户</option><option v-for="user in users" :key="user.id" :value="user.id">{{ user.username }}（{{ user.role === 'admin' ? '管理员' : 'APP用户' }} · {{ user.deviceCount }} 台）</option></select></div>
            <div v-if="targetUserId" class="target-list-wrap">
              <div class="target-list-heading"><strong>该用户的绑定设备</strong><span>已选 {{ selectedUserDeviceCodes.length }} / {{ userDevices.length }} 台</span></div>
              <div v-if="loadingUserDevices" class="empty-state">正在读取用户设备...</div>
              <div v-else-if="!userDevices.length" class="empty-state">该用户暂无绑定设备</div>
              <label v-for="device in userDevices" :key="device.deviceCode" class="target-row">
                <input v-model="selectedUserDeviceCodes" type="checkbox" :value="device.deviceCode" @change="clearPreview">
                <span class="target-copy"><strong>{{ device.remarkName || device.deviceName || '--' }}</strong><small>{{ device.deviceCode }}</small></span>
                <span class="tag" :class="Number(device.online) === 1 ? 'success' : 'danger'">{{ Number(device.online) === 1 ? '在线' : '离线' }}</span>
              </label>
            </div>
          </div>

          <div v-if="scope === 'device'" class="target-picker">
            <div class="search-box ota-search"><span class="search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg></span><input v-model.trim="deviceKeyword" placeholder="搜索设备名称或编号" @input="clearPreview"></div>
            <div v-if="loadingDevices" class="empty-state">正在读取设备...</div>
            <div v-else class="target-list-wrap target-device-results">
              <label v-for="device in filteredDevices" :key="device.deviceCode" class="target-row" :class="{ selected: deviceCode === device.deviceCode }">
                <input v-model="deviceCode" type="radio" name="ota-device" :value="device.deviceCode" @change="clearPreview">
                <span class="target-copy"><strong>{{ device.remarkName || device.deviceName || '--' }}</strong><small>{{ device.deviceCode }} · {{ device.owner?.username || '无所属用户' }}</small></span>
                <span class="tag" :class="Number(device.online) === 1 ? 'success' : 'danger'">{{ Number(device.online) === 1 ? '在线' : '离线' }}</span>
              </label>
              <div v-if="!filteredDevices.length" class="empty-state">没有匹配的已绑定设备</div>
            </div>
          </div>

          <div v-if="scope === 'all'" class="ota-inline-notice">将覆盖全部已绑定设备。开始前会逐台重新校验在线状态，离线设备不会下发。</div>
          <div class="ota-actions"><button class="primary-btn" type="button" :disabled="previewing || !firmwareFile || !canPreview" @click="previewTargets">{{ previewing ? '正在预览...' : '预览升级范围' }}</button></div>
        </div>
      </section>

      <section v-if="preview" class="panel ota-panel">
        <div class="panel-header"><div><h2>升级范围预览</h2><p>{{ preview.firmware.firmwareFile }} · {{ preview.firmware.firmwareVersion || '版本未识别' }}</p></div><span class="tag success">校验后逐台串行下发</span></div>
        <div class="ota-panel-body">
          <div class="preview-stats">
            <div><span>目标设备</span><strong>{{ preview.targetCount }}</strong></div>
            <div><span>当前在线，可升级</span><strong class="good-count">{{ preview.eligibleCount }}</strong></div>
            <div><span>当前离线，将跳过</span><strong class="skip-count">{{ preview.skippedCount }}</strong></div>
          </div>
          <div class="target-list-wrap preview-targets">
            <div v-for="device in preview.devices" :key="device.deviceCode" class="target-row">
              <span class="target-copy"><strong>{{ device.remarkName || device.deviceCode }}</strong><small>{{ device.deviceCode }} · {{ device.ownerName || '无所属用户' }}</small></span>
              <span class="tag" :class="device.eligible ? 'success' : 'warning'">{{ device.eligible ? '待升级' : device.reason }}</span>
            </div>
          </div>
          <div class="ota-actions"><button class="primary-btn" type="button" :disabled="creatingBatch || preview.eligibleCount === 0" @click="confirmVisible = true">{{ creatingBatch ? '正在创建...' : `确认更新 ${preview.eligibleCount} 台设备` }}</button></div>
        </div>
      </section>
    </template>

    <template v-else>
      <div class="toolbar ota-toolbar">
        <div class="filter-group">
          <select v-model="historyStatus" class="filter-select" @change="loadBatches(1)"><option value="">全部状态</option><option value="queued">排队中</option><option value="running">升级中</option><option value="paused">已暂停</option><option value="success">全部成功</option><option value="partial">部分完成</option><option value="failed">全部失败</option><option value="skipped">全部跳过</option></select>
          <button class="secondary-btn" type="button" @click="loadBatches(batchPage)">刷新</button>
        </div>
        <button class="primary-btn" type="button" @click="section = 'create'">+ 发起更新</button>
      </div>

      <section class="panel ota-panel history-panel">
        <div class="panel-header"><div><h2>升级批次</h2><p>批次与逐设备结果会保存，可在刷新或重新登录后继续查看</p></div></div>
        <div class="table-wrap ota-table-wrap">
          <table class="data-table ota-table">
            <thead><tr><th>创建时间</th><th>升级范围</th><th>目标固件</th><th>设备进度</th><th>状态</th><th>操作人</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-if="loadingBatches"><td colspan="7" class="empty-state">批次加载中...</td></tr>
              <tr v-else-if="!batches.length"><td colspan="7" class="empty-state">暂无 OTA 批次</td></tr>
              <tr v-for="batch in batches" :key="batch.id">
                <td>{{ formatTime(batch.createdAt) }}</td>
                <td>{{ scopeLabel(batch.scope, batch.targetUserName) }}</td>
                <td><strong>{{ batch.firmwareVersion || batch.firmwareFile }}</strong><small class="table-subline">{{ batch.firmwareFile }}</small></td>
                <td>{{ batch.successCount }} 成功 · {{ batch.failedCount }} 失败 · {{ batch.skippedCount }} 跳过 / {{ batch.targetCount }} 台</td>
                <td><span class="tag" :class="statusTone(batch.status)">{{ statusLabel(batch.status) }}</span></td>
                <td>{{ batch.operatorName || '--' }}</td>
                <td><button class="text-btn" type="button" @click="selectBatch(batch.id)">查看详情</button></td>
              </tr>
            </tbody>
          </table>
          <AppPagination :page="batchPage" :total="batchTotal" :total-pages="batchTotalPages" @change="loadBatches" />
        </div>
      </section>

      <section v-if="selectedBatch" class="panel ota-panel batch-detail-panel">
        <div class="panel-header"><div><h2>批次详情</h2><p>{{ selectedBatch.id }} · {{ selectedBatch.firmwareFile }} · {{ selectedBatch.firmwareVersion || '版本未识别' }}</p></div><span class="tag" :class="statusTone(selectedBatch.status)">{{ statusLabel(selectedBatch.status) }}</span></div>
        <div class="batch-summary">
          <div><span>目标</span><strong>{{ selectedBatch.targetCount }}</strong></div>
          <div><span>成功</span><strong class="good-count">{{ selectedBatch.successCount }}</strong></div>
          <div><span>失败</span><strong class="fail-count">{{ selectedBatch.failedCount }}</strong></div>
          <div><span>跳过</span><strong class="skip-count">{{ selectedBatch.skippedCount }}</strong></div>
        </div>
        <div class="batch-actions">
          <button v-if="selectedBatch.status === 'queued' || selectedBatch.status === 'running'" class="secondary-btn" type="button" :disabled="batchActionBusy" @click="runBatchAction('pause')">暂停后续设备</button>
          <button v-if="selectedBatch.status === 'paused'" class="secondary-btn" type="button" :disabled="batchActionBusy" @click="runBatchAction('resume')">恢复队列</button>
          <button v-if="selectedBatch.failedCount > 0" class="secondary-btn" type="button" :disabled="batchActionBusy" @click="retryFailed">重试失败设备</button>
        </div>
        <div class="table-wrap ota-table-wrap">
          <table class="data-table ota-task-table">
            <thead><tr><th>设备</th><th>所属用户</th><th>状态</th><th>进度</th><th>结果 / 错误</th><th>重试次数</th><th>开始时间</th></tr></thead>
            <tbody>
              <tr v-if="!selectedBatch.tasks?.length"><td colspan="7" class="empty-state">批次没有设备任务</td></tr>
              <tr v-for="task in selectedBatch.tasks" :key="task.id">
                <td><strong>{{ task.deviceCode }}</strong><small class="table-subline">{{ task.id }}</small></td>
                <td>{{ task.ownerName || '--' }}</td>
                <td><span class="tag" :class="statusTone(task.status)">{{ statusLabel(task.status) }}</span></td>
                <td><div class="ota-progress"><i :style="{ width: `${task.progress}%` }"></i></div><small>{{ Number(task.progress).toFixed(1) }}% · {{ task.offset }} / {{ task.firmwareSize }} B</small></td>
                <td class="task-message">{{ task.message }}</td>
                <td>{{ task.retryCount || 0 }}</td>
                <td>{{ formatTime(task.startedAt || task.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <AppModal v-model="confirmVisible" title="确认 OTA 更新" confirm-text="创建升级批次" :loading="creatingBatch" @confirm="createBatch">
      <p class="confirm-copy">将使用固件 <strong>{{ selectedFirmware?.firmwareVersion || firmwareFile }}</strong>，对预览中的 <strong>{{ preview?.eligibleCount || 0 }} 台在线设备</strong>逐台执行 OTA。离线设备会记录为跳过。</p>
      <p class="confirm-copy ota-confirm-warning">每台设备完成或失败后才会处理下一台；升级期间设备可能短暂离线。</p>
    </AppModal>
    <AppModal v-model="uploadConfirmVisible" title="确认覆盖固件" confirm-text="上传并覆盖" :loading="uploadingFirmware" @confirm="uploadFirmware">
      <p class="confirm-copy">将把本地文件 <strong>{{ uploadCandidate?.name }}</strong> 上传到服务器固件目录，并覆盖其中的 <strong>lobster-feeder.pkg</strong>。</p>
      <p class="confirm-copy">识别版本：<strong>{{ uploadCandidate?.version || '未识别版本' }}</strong>；文件大小：<strong>{{ formatBytes(uploadCandidate?.size) }}</strong>。</p>
      <p class="confirm-copy ota-confirm-warning">上传不会自动开始设备升级；OTA 队列有待执行或执行中任务时，服务器会拒绝覆盖。</p>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppModal from '../components/AppModal.vue';
import AppPagination from '../components/AppPagination.vue';
import { api } from '../services/api.js';
import { formatTime } from '../utils/format.js';
import { showToast } from '../utils/toast.js';

const scopes = [
  { key: 'all', title: '全部设备', description: '全部已绑定设备，按在线状态筛选' },
  { key: 'user', title: '指定用户', description: '选择任一账号并勾选其绑定设备' },
  { key: 'device', title: '单个设备', description: '搜索设备后单独发起更新' },
];
const section = ref('create');
const scope = ref('all');
const firmwares = ref([]);
const firmwareFile = ref('');
const users = ref([]);
const targetUserId = ref('');
const userDevices = ref([]);
const selectedUserDeviceCodes = ref([]);
const devices = ref([]);
const deviceKeyword = ref('');
const deviceCode = ref('');
const preview = ref(null);
const loadingFirmwares = ref(true);
const loadingDevices = ref(false);
const loadingUserDevices = ref(false);
const previewing = ref(false);
const creatingBatch = ref(false);
const confirmVisible = ref(false);
const batches = ref([]);
const batchPage = ref(1);
const batchPageSize = 10;
const batchTotal = ref(0);
const batchTotalPages = ref(1);
const historyStatus = ref('');
const loadingBatches = ref(false);
const selectedBatch = ref(null);
const batchActionBusy = ref(false);
const firmwareInput = ref(null);
const uploadCandidate = ref(null);
const uploadedFirmware = ref(null);
const uploadConfirmVisible = ref(false);
const uploadingFirmware = ref(false);
let pollTimer = null;

const selectedFirmware = computed(() => firmwares.value.find(item => item.firmwareFile === firmwareFile.value) || null);
const canPreview = computed(() => {
  if (scope.value === 'user') return Boolean(targetUserId.value) && selectedUserDeviceCodes.value.length > 0;
  if (scope.value === 'device') return Boolean(deviceCode.value);
  return true;
});
const filteredDevices = computed(() => {
  const keyword = deviceKeyword.value.toLowerCase();
  if (!keyword) return devices.value;
  return devices.value.filter(item => `${item.deviceCode} ${item.remarkName || ''} ${item.deviceName || ''} ${item.owner?.username || ''}`.toLowerCase().includes(keyword));
});

const clearPreview = () => { preview.value = null; };

const inspectFirmwareFile = async (event) => {
  const file = event.target.files?.[0];
  uploadCandidate.value = null;
  uploadedFirmware.value = null;
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pkg')) {
    showToast('请选择 .pkg 固件文件', 'error');
    event.target.value = '';
    return;
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    showToast('固件文件需大于 0 且不超过 10 MB', 'error');
    event.target.value = '';
    return;
  }
  try {
    const content = new TextDecoder('latin1').decode(await file.arrayBuffer());
    const version = content.match(/Ver[:= ]*([A-Za-z0-9._-]+)/i)?.[1] || '';
    uploadCandidate.value = { file, name: file.name, size: file.size, version };
  } catch {
    showToast('读取固件文件失败', 'error');
    event.target.value = '';
  }
};

const uploadFirmware = async () => {
  if (!uploadCandidate.value) return;
  uploadingFirmware.value = true;
  try {
    const result = await api.uploadBinary('/api/ota/firmwares/lobster-feeder.pkg', uploadCandidate.value.file);
    uploadedFirmware.value = result;
    firmwareFile.value = result.firmwareFile;
    clearPreview();
    await loadFirmwares();
    uploadConfirmVisible.value = false;
    uploadCandidate.value = null;
    if (firmwareInput.value) firmwareInput.value.value = '';
    showToast(`固件已覆盖：${result.firmwareVersion || result.firmwareFile}`);
  } catch (error) { showToast(error.message, 'error'); }
  finally { uploadingFirmware.value = false; }
};
const selectScope = (nextScope) => {
  scope.value = nextScope;
  clearPreview();
  if (nextScope === 'device' && !devices.value.length) loadDevices();
};

const loadFirmwares = async () => {
  loadingFirmwares.value = true;
  try {
    firmwares.value = await api.get('/api/ota/firmwares');
    if (firmwares.value.length === 1) firmwareFile.value = firmwares.value[0].firmwareFile;
  } catch (error) { showToast(error.message, 'error'); }
  finally { loadingFirmwares.value = false; }
};

const loadUsers = async () => {
  try {
    const first = await api.get('/api/admin/users', { page: 1, pageSize: 100 });
    users.value = [...first.list];
    for (let page = 2; page <= first.totalPages; page += 1) {
      const next = await api.get('/api/admin/users', { page, pageSize: 100 });
      users.value.push(...next.list);
    }
  } catch (error) { showToast(error.message, 'error'); }
};

const loadUserDevices = async () => {
  clearPreview();
  userDevices.value = [];
  selectedUserDeviceCodes.value = [];
  if (!targetUserId.value) return;
  loadingUserDevices.value = true;
  try {
    const result = await api.get(`/api/admin/users/${targetUserId.value}/devices`);
    userDevices.value = result.devices || [];
    selectedUserDeviceCodes.value = userDevices.value.map(item => item.deviceCode);
  } catch (error) { showToast(error.message, 'error'); }
  finally { loadingUserDevices.value = false; }
};

const loadDevices = async () => {
  loadingDevices.value = true;
  try {
    const first = await api.get('/api/admin/devices', { page: 1, pageSize: 100, status: 1 });
    devices.value = [...first.list];
    for (let page = 2; page <= first.totalPages; page += 1) {
      const next = await api.get('/api/admin/devices', { page, pageSize: 100, status: 1 });
      devices.value.push(...next.list);
    }
  } catch (error) { showToast(error.message, 'error'); }
  finally { loadingDevices.value = false; }
};

const getScopePayload = () => {
  const payload = { firmwareFile: firmwareFile.value, scope: scope.value };
  if (scope.value === 'user') {
    payload.targetUserId = Number(targetUserId.value);
    if (selectedUserDeviceCodes.value.length < userDevices.value.length) payload.deviceCodes = selectedUserDeviceCodes.value;
  }
  if (scope.value === 'device') payload.deviceCode = deviceCode.value;
  return payload;
};

const previewTargets = async () => {
  if (!firmwareFile.value) return showToast('请选择固件文件', 'error');
  if (!canPreview.value) return showToast('请先选择升级设备范围', 'error');
  previewing.value = true;
  try { preview.value = await api.post('/api/ota/preview', getScopePayload()); }
  catch (error) { showToast(error.message, 'error'); }
  finally { previewing.value = false; }
};

const createBatch = async () => {
  creatingBatch.value = true;
  try {
    const result = await api.post('/api/ota/batches', getScopePayload());
    confirmVisible.value = false;
    section.value = 'history';
    historyStatus.value = '';
    await loadBatches(1);
    await selectBatch(result.id);
    showToast('OTA批次已创建，设备将逐台升级');
  } catch (error) { showToast(error.message, 'error'); }
  finally { creatingBatch.value = false; }
};

const openHistory = async () => {
  section.value = 'history';
  await loadBatches(1);
};

const loadBatches = async (page = batchPage.value) => {
  loadingBatches.value = true;
  try {
    const result = await api.get('/api/ota/batches', { page, pageSize: batchPageSize, status: historyStatus.value });
    batches.value = result.list || [];
    batchPage.value = result.page || page;
    batchTotal.value = result.total || 0;
    batchTotalPages.value = result.totalPages || 1;
  } catch (error) { showToast(error.message, 'error'); }
  finally { loadingBatches.value = false; }
};

const selectBatch = async (batchId) => {
  try { selectedBatch.value = await api.get(`/api/ota/batches/${batchId}`); }
  catch (error) { showToast(error.message, 'error'); }
};

const runBatchAction = async (action) => {
  if (!selectedBatch.value) return;
  batchActionBusy.value = true;
  try {
    selectedBatch.value = await api.post(`/api/ota/batches/${selectedBatch.value.id}/${action}`, {});
    await loadBatches(batchPage.value);
    showToast(action === 'pause' ? '当前设备完成后将暂停队列' : 'OTA队列已恢复');
  } catch (error) { showToast(error.message, 'error'); }
  finally { batchActionBusy.value = false; }
};

const retryFailed = async () => {
  if (!selectedBatch.value) return;
  batchActionBusy.value = true;
  try {
    selectedBatch.value = await api.post(`/api/ota/batches/${selectedBatch.value.id}/retry-failed`, {});
    await loadBatches(batchPage.value);
    showToast('失败设备已重新排队');
  } catch (error) { showToast(error.message, 'error'); }
  finally { batchActionBusy.value = false; }
};

const refreshSelectedBatch = async () => {
  if (section.value !== 'history' || !selectedBatch.value) return;
  const currentId = selectedBatch.value.id;
  try {
    const result = await api.get(`/api/ota/batches/${currentId}`);
    if (selectedBatch.value?.id === currentId) selectedBatch.value = result;
    await loadBatches(batchPage.value);
  } catch { /* keep the last visible state while polling */ }
};

const formatBytes = value => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};
const statusLabels = { queued: '排队中', pending: '等待中', starting: '启动中', transferring: '传输中', verifying: '校验中', rebooting: '重启中', running: '升级中', paused: '已暂停', success: '成功', partial: '部分完成', failed: '失败', skipped: '已跳过' };
const statusLabel = status => statusLabels[status] || status || '--';
const statusTone = status => ['success'].includes(status) ? 'success' : ['failed'].includes(status) ? 'danger' : ['partial', 'paused', 'skipped'].includes(status) ? 'warning' : ['running', 'starting', 'transferring', 'verifying', 'rebooting', 'pending', 'queued'].includes(status) ? 'checking' : 'neutral';
const scopeLabel = (value, username) => value === 'all' ? '全部设备' : value === 'user' ? `用户：${username || '--'}` : value === 'device' ? '单个设备' : value || '--';

onMounted(() => {
  loadFirmwares();
  loadUsers();
  loadBatches(1);
  pollTimer = setInterval(refreshSelectedBatch, 3000);
});
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<style scoped>
.ota-view { display: grid; gap: 18px; }
.ota-tabs { display: flex; gap: 7px; padding: 5px; width: max-content; border: 1px solid var(--line); border-radius: 11px; background: #f6f7fa; }
.ota-tabs button { height: 34px; padding: 0 15px; border: 0; border-radius: 8px; color: var(--muted); background: transparent; font-weight: 650; }
.ota-tabs button.active { color: var(--primary); background: #fff; box-shadow: 0 2px 8px rgba(28,42,80,.08); }
.ota-panel { overflow: hidden; }
.ota-panel-body { padding: 22px; }
.ota-panel-body .form-field { max-width: 640px; }
.ota-panel-body .form-control { width: 100%; }
.firmware-meta { display: grid; grid-template-columns: minmax(120px, .7fr) minmax(120px, .6fr) minmax(220px, 2fr); gap: 14px; margin-top: 18px; }
.upload-control { display: grid; gap: 8px; }
.upload-control input { max-width: 520px; color: var(--ink); font-size: 13px; }
.upload-hint { color: var(--muted); font-size: 12px; }
.upload-meta { grid-template-columns: minmax(180px, 1.5fr) minmax(140px, .8fr) minmax(120px, .6fr); }
.upload-actions { justify-content: flex-start; }
.upload-success { margin-top: 14px; padding: 11px 13px; border-radius: 9px; color: #128565; background: #effaf6; font-size: 12px; }
.firmware-meta > div, .preview-stats > div, .batch-summary > div { display: grid; gap: 7px; padding: 14px 16px; border: 1px solid #edf0f5; border-radius: 11px; background: #fafbfe; }
.firmware-meta span, .preview-stats span, .batch-summary span { color: var(--muted); font-size: 12px; }
.firmware-meta strong { overflow-wrap: anywhere; color: var(--ink); font-size: 13px; }
.firmware-meta .hash-value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.scope-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.scope-card { display: grid; grid-template-columns: 18px 1fr; align-content: start; gap: 6px 10px; min-height: 108px; padding: 17px; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); background: #fff; text-align: left; }
.scope-card.active { border-color: #91a6f6; background: #f6f8ff; box-shadow: 0 0 0 2px rgba(49,87,229,.08); }
.scope-card strong { align-self: center; font-size: 14px; }
.scope-card small { grid-column: 2; color: var(--muted); font-size: 12px; line-height: 1.5; }
.scope-radio { width: 16px; height: 16px; display: grid; place-items: center; border: 1.5px solid #b9c1d0; border-radius: 50%; }
.scope-card.active .scope-radio { border-color: var(--primary); }
.scope-card.active .scope-radio i { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
.target-picker { display: grid; gap: 14px; max-width: 900px; margin-top: 20px; }
.target-list-wrap { max-height: 300px; overflow: auto; border: 1px solid var(--line); border-radius: 11px; background: #fff; }
.target-list-heading { position: sticky; top: 0; z-index: 1; display: flex; justify-content: space-between; padding: 13px 15px; border-bottom: 1px solid var(--line); color: var(--ink); background: #fafbfe; font-size: 12px; }
.target-list-heading span { color: var(--muted); }
.target-row { display: flex; align-items: center; gap: 12px; min-height: 58px; padding: 9px 15px; border-bottom: 1px solid #f0f2f6; }
.target-row:last-child { border-bottom: 0; }
.target-row input { accent-color: var(--primary); }
.target-row.selected { background: #f7f9ff; }
.target-copy { display: grid; flex: 1; min-width: 0; gap: 4px; }
.target-copy strong { overflow: hidden; color: var(--ink); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.target-copy small, .table-subline { display: block; margin-top: 4px; color: var(--muted); font-size: 11px; }
.ota-inline-notice { margin-top: 16px; padding: 12px 14px; border: 1px solid #e9edf5; border-radius: 9px; color: #68748b; background: #f8f9fc; font-size: 12px; line-height: 1.6; }
.ota-actions { display: flex; justify-content: flex-end; margin-top: 18px; }
.ota-actions button { min-width: 170px; }
.preview-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.preview-stats strong, .batch-summary strong { color: var(--ink); font-size: 23px; }
.preview-stats .good-count, .batch-summary .good-count { color: #128565; }
.preview-stats .skip-count, .batch-summary .skip-count { color: #aa6b1a; }
.batch-summary .fail-count { color: #cb3c47; }
.preview-targets { max-height: 240px; margin-top: 16px; }
.ota-search { width: min(100%, 430px); }
.target-device-results { max-height: 340px; }
.ota-toolbar { margin-bottom: 0; }
.ota-table-wrap { border: 0; border-radius: 0; box-shadow: none; }
.ota-table { min-width: 940px; }
.ota-table td { height: 62px; }
.batch-detail-panel { overflow: hidden; }
.batch-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 18px 22px 0; }
.batch-actions { display: flex; justify-content: flex-end; gap: 9px; padding: 14px 22px; }
.ota-task-table { min-width: 1150px; }
.ota-task-table td { height: 70px; }
.ota-task-table td strong { color: var(--ink); }
.ota-task-table .task-message { max-width: 300px; color: #586276; white-space: normal; }
.ota-progress { width: 130px; height: 7px; overflow: hidden; margin-bottom: 5px; border-radius: 99px; background: #e9edf5; }
.ota-progress i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #3157e5, #8199f5); transition: width .25s ease; }
.ota-task-table td small { color: var(--muted); font-size: 10px; }
.ota-confirm-warning { color: #9a6a20; }
@media (max-width: 900px) {
  .scope-cards { grid-template-columns: 1fr; }
  .firmware-meta, .preview-stats, .batch-summary { grid-template-columns: 1fr; }
  .ota-toolbar { align-items: flex-start; flex-direction: column; }
}
</style>
