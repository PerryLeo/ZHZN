<template>
  <div class="table-page">
  <div class="toolbar device-toolbar">
    <div class="filter-group">
      <div class="search-box">
        <span class="search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="10.8" cy="10.8" r="6.3" />
            <path d="m16 16 4 4" />
          </svg>
        </span>
        <input v-model.trim="query.keyword" placeholder="搜索设备名称或编码" @keyup.enter="search">
      </div>
      <AppSearchSelect v-model="query.userId" class="owner-filter" label="所属用户" empty-label="全部用户" search-placeholder="搜索用户账号" :options="ownerOptions" @change="changeOwner" />
      <AppSearchSelect v-model="selectedGroupId" label="设备分组" placeholder="设备分组" empty-label="全部设备分组" :options="groupOptions" :disabled="!query.userId || groupsLoading" @change="search" />
      <AppSearchSelect v-model="query.status" label="在线状态" placeholder="在线状态" empty-label="全部设备" :options="statusOptions" :disabled="!query.userId" @change="search" />
      <AppSearchSelect v-model="query.abnormalStatus" label="异常状态" placeholder="异常状态" empty-label="全部设备" :options="abnormalStatusOptions" :disabled="!query.userId" @change="search" />
      <button class="secondary-btn" type="button" @click="search">查询</button>
      <button class="icon-btn" type="button" title="刷新当前页" aria-label="刷新当前页" :disabled="loading" @click="refreshCurrentPage">
        <AppIcon name="refresh" :size="19" />
      </button>
      <span v-if="onlineStatusChecking" class="online-checking-hint"><i></i>{{ statusCheckingText }}</span>
    </div>
    <div class="toolbar-actions">
      <button class="primary-btn" type="button" @click="openDeviceForm()">+ 登记设备</button>
    </div>
  </div>

  <div class="table-wrap">
    <div class="table-scroll">
    <table class="data-table devices-table">
      <thead><tr>
        <th :aria-sort="getAriaSort('remarkName')">
          <button
            class="table-sort-btn"
            :class="{ active: query.sortBy === 'remarkName' }"
            type="button"
            :title="getSortTitle('remarkName')"
            @click="toggleSort('remarkName')"
          >
            <span>设备信息</span>
            <span class="sort-caret" aria-hidden="true">
              <i class="up" :class="{ active: query.sortBy === 'remarkName' && query.sortOrder === 'asc' }"></i>
              <i class="down" :class="{ active: query.sortBy === 'remarkName' && query.sortOrder === 'desc' }"></i>
            </span>
          </button>
        </th>
        <th>设备初始名称</th><th>所属用户</th><th>在线状态</th><th>信号</th><th>运行状态</th><th>完成度</th><th>快捷控制</th><th>实时数据</th><th>异常状态</th><th>绑定状态</th><th>更新时间</th><th>操作</th>
      </tr></thead>
      <tbody>
        <tr v-if="loading"><td colspan="13" class="empty-state">{{ loadingText }}</td></tr>
        <tr v-else-if="!pageData.list.length"><td colspan="13" class="empty-state">暂无符合条件的设备</td></tr>
        <template v-else>
          <tr v-for="item in pageData.list" :key="item.id" :class="{ 'clickable-row': !item.onlineChecking, 'device-row-disabled': item.onlineChecking }" @click="openDetail(item)">
            <td>
              <div class="device-cell">
                <span class="device-thumb device-asset-thumb" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="7" y="7" width="10" height="10" rx="2" />
                    <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" />
                    <path d="M10 10h4v4h-4z" />
                  </svg>
                  <i :class="{ online: getDeviceStatus(item).isOnline, checking: item.onlineChecking }"></i>
                </span>
                <div><strong>{{ item.remarkName || '--' }}</strong><span>{{ item.deviceCode }}</span></div>
              </div>
            </td>
            <td>{{ item.reportedDeviceName || '--' }}</td>
            <td>{{ item.owner?.username || '--' }}</td>
            <td><span class="tag" :class="getDeviceStatus(item).tone">{{ getDeviceStatus(item).label }}</span></td>
            <td>
              <span class="csq-signal" :class="`level-${getCsqSignalLevel(item.signalStrength)}`" :title="formatSignalTitle(item.signalStrength)">
                <i :class="{ active: getCsqSignalLevel(item.signalStrength) >= 1 }"></i>
                <i :class="{ active: getCsqSignalLevel(item.signalStrength) >= 2 }"></i>
                <i :class="{ active: getCsqSignalLevel(item.signalStrength) >= 3 }"></i>
              </span>
            </td>
            <td><span :class="['device-run-state', item.controlState]">{{ item.onlineChecking ? '检测中' : item.controlStateLabel || '未知' }}</span></td>
            <td><span class="device-trip-progress">{{ item.onlineChecking ? '检测中' : item.tripProgress || '--' }}</span></td>
            <td><button class="text-btn device-control-btn" type="button" :disabled="!canControlDevice(item)" @click.stop="handleDeviceAction(item)">{{ getDeviceActionLabel(item) }}</button></td>
            <td><div class="device-live-data"><span>电量 {{ formatBattery(item.batteryLevel) }}</span><span>充电电流 {{ formatCurrent(item.chargingCurrent) }}</span></div></td>
            <td><span :class="['device-alarm', { abnormal: item.hasAlarm }]">{{ item.onlineChecking ? '检测中' : item.abnormalStatus || '--' }}</span></td>
            <td><span class="tag" :class="item.status === 1 ? 'success' : 'neutral'">{{ item.status === 1 ? '已绑定' : '未绑定' }}</span></td>
            <td>{{ formatTime(item.updatedAt) }}</td>
            <td><div class="row-actions"><button class="text-btn" type="button" @click.stop="openDetail(item)">查看详情</button><button class="text-btn" type="button" @click.stop="openDeviceForm(item)">编辑</button><button v-if="item.status === 1" class="text-btn danger" type="button" @click.stop="openUnbind(item)">解绑</button><template v-else><button class="text-btn" type="button" @click.stop="openBind(item)">绑定</button><button class="text-btn danger" type="button" @click.stop="openDelete(item)">删除</button></template></div></td>
          </tr>
        </template>
      </tbody>
    </table>
    </div>
    <AppPagination
      :page="pageData.page"
      :total="pageData.total"
      :total-pages="pageData.totalPages"
      :page-size="pageData.pageSize"
      :disabled="loading"
      @change="changePage"
      @page-size-change="changePageSize"
    />
  </div>
  </div>

  <AppModal v-model="deviceModal.visible" :title="deviceModal.editing ? '编辑设备' : '登记设备'" :loading="submitting" @confirm="saveDevice">
    <div class="form-field"><label>设备编码</label><input v-model.trim="deviceForm.deviceCode" class="form-control" :disabled="Boolean(deviceModal.editing)" placeholder="请输入设备唯一编码" required></div>
    <div class="form-field"><label>设备初始名称</label><input v-model.trim="deviceForm.deviceName" class="form-control" :disabled="Boolean(deviceModal.editing)" placeholder="请输入硬件设备名称" required></div>
    <div v-if="deviceModal.editing" class="form-field"><label>备注名称</label><input v-model.trim="deviceForm.remarkName" class="form-control" placeholder="请输入备注名称"></div>
    <div class="form-field"><label for="device-type">设备类型</label><input id="device-type" class="form-control" :value="typeLabel(deviceModal.editing?.deviceType || 'dtu')" readonly></div>
  </AppModal>

  <AppModal v-model="bindModal.visible" title="分配设备" confirm-text="确认分配" :loading="submitting" @confirm="bindDevice">
    <p class="confirm-copy">为设备 <strong>{{ bindModal.device?.remarkName || '--' }}</strong> 选择平台所属用户，APP 与 PC 端将同步显示。</p>
    <div class="form-field bind-user-field"><label for="bind-user">目标用户</label><AppSearchSelect id="bind-user" v-model="bindUserId" label="目标用户" search-placeholder="搜索用户账号" :options="bindUserOptions" full-width /></div>
  </AppModal>

  <AppModal v-model="unbindModal.visible" title="解绑设备" confirm-text="确认操作" danger :loading="submitting" @confirm="unbindDevice">
    <p class="confirm-copy">确认解除 <strong>{{ unbindModal.device?.remarkName || '--' }}</strong> 与用户 <strong>{{ unbindModal.device?.owner?.username }}</strong> 的绑定吗？APP 将同步失去该设备。</p>
  </AppModal>

  <AppModal v-model="deleteModal.visible" title="删除设备" confirm-text="确认删除" danger :loading="submitting" @confirm="deleteDevice">
    <p class="confirm-copy">确认永久删除设备 <strong>{{ deleteModal.device?.remarkName || '--' }}</strong> 吗？设备资料删除后无法恢复。</p>
  </AppModal>

</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import AppModal from '../components/AppModal.vue';
import AppPagination from '../components/AppPagination.vue';
import AppSearchSelect from '../components/AppSearchSelect.vue';
import { api } from '../services/api.js';
import { setSelectedDevice } from '../services/deviceNavigation.js';
import { formatTime, typeLabel } from '../utils/format.js';
import { getDeviceStatus } from '../utils/deviceStatus.js';
import { getCsqSignalLevel, parseDeviceStatusReport } from '../utils/deviceProtocol.js';
import { showToast } from '../utils/toast.js';

const statusOptions = [
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' },
];
const abnormalStatusOptions = [
  { value: 'normal', label: '正常' },
  { value: 'abnormal', label: '异常' },
];
const loading = ref(false);
const submitting = ref(false);
const onlineStatusChecking = ref(false);
const statusQueryLimit = 10;
const fullStatusQueryLimit = 100;
const statusProbeConcurrency = 2;
const statusProbeProgress = reactive({ completed: 0, total: 0 });
const probedFilteredDevices = ref(null);
const statusCheckingText = computed(() => {
  if (statusProbeProgress.total <= 0) return '正在检测当前页设备在线状态...';
  if (statusProbeProgress.total <= fullStatusQueryLimit) {
    return `正在并发检测设备状态（共 ${statusProbeProgress.total} 台）...`;
  }
  return `正在实时检测设备状态（${statusProbeProgress.completed}/${statusProbeProgress.total}）...`;
});
const loadingText = computed(() => (
  onlineStatusChecking.value && statusProbeProgress.total > 0
    ? statusCheckingText.value
    : '数据加载中...'
));
const query = reactive({ page: 1, pageSize: 10, keyword: '', status: '', abnormalStatus: '', userId: '', sortBy: '', sortOrder: '' });
const pageData = reactive({ list: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
const deviceModal = reactive({ visible: false, editing: null });
const bindModal = reactive({ visible: false, device: null });
const unbindModal = reactive({ visible: false, device: null });
const deleteModal = reactive({ visible: false, device: null });
const deviceForm = reactive({ deviceCode: '', deviceName: '', remarkName: '' });
const users = ref([]);
const ownerOptions = computed(() => users.value.map(user => ({ value: user.id, label: user.username })));
const bindUserOptions = computed(() => users.value.map(user => ({
  value: Number(user.id),
  label: `${user.username}（${user.deviceCount} 台设备）`,
})));
const bindUserId = ref(null);
const deviceGroups = ref([]);
const groupOptions = computed(() => deviceGroups.value.map(group => ({
  value: group.id,
  label: `${group.name}（${group.deviceCount}）`,
})));
const selectedGroupId = ref('');
const groupsLoading = ref(false);
let groupRequestId = 0;
const router = useRouter();
let listRequestId = 0;

const refreshDeviceStatusBatch = async (devices) => {
  try {
    const result = await api.post('/api/devices/batchQueryStatus', {
      deviceCodes: devices.map(device => device.deviceCode),
      timeout: 5000,
    });
    const statusMap = new Map((result?.results || []).map(item => [item.deviceCode, item]));
    devices.forEach(device => {
      const status = statusMap.get(device.deviceCode);
      device.online = status?.success ? 1 : 0;
      if (status?.success) {
        Object.assign(device, parseDeviceStatusReport(status));
      } else {
        device.abnormalStatus = '--';
        device.hasAlarm = false;
      }
    });
  } finally {
    devices.forEach(device => { device.onlineChecking = false; });
  }
};

const refreshCurrentPageOnlineStatus = async (devices, requestId) => {
  if (!devices.length) return;
  devices.forEach(device => {
    device.signalStrength = null;
    device.reportedDeviceName = '';
    device.onlineChecking = true;
  });
  onlineStatusChecking.value = true;
  let firstError;
  try {
    for (let index = 0; index < devices.length && requestId === listRequestId; index += statusQueryLimit) {
      try {
        await refreshDeviceStatusBatch(devices.slice(index, index + statusQueryLimit));
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError && requestId === listRequestId) {
      showToast(firstError.message || '设备在线状态检测失败', 'error');
    }
  } finally {
    if (requestId === listRequestId) onlineStatusChecking.value = false;
  }
};

const applyProbedPage = () => {
  const list = probedFilteredDevices.value || [];
  const total = list.length;
  const totalPages = Math.ceil(total / query.pageSize);
  const lastPage = Math.max(totalPages, 1);
  if (query.page > lastPage) query.page = lastPage;
  const start = (query.page - 1) * query.pageSize;
  Object.assign(pageData, {
    list: list.slice(start, start + query.pageSize),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages,
  });
};

const fetchAllScopedDevices = async (baseParams, requestId) => {
  const first = await api.get('/api/admin/devices', { ...baseParams, page: 1, pageSize: 100 });
  if (requestId !== listRequestId) return [];
  const list = [...first.list];
  for (let page = 2; page <= first.totalPages && requestId === listRequestId; page += 1) {
    const next = await api.get('/api/admin/devices', { ...baseParams, page, pageSize: 100 });
    if (requestId !== listRequestId) return [];
    list.push(...next.list);
  }
  return list;
};

const probeDevicesInBatches = async (devices, requestId) => {
  statusProbeProgress.completed = 0;
  statusProbeProgress.total = devices.length;
  if (!devices.length) return;
  devices.forEach(device => {
    device.signalStrength = null;
    device.reportedDeviceName = '';
    device.onlineChecking = true;
  });
  onlineStatusChecking.value = true;
  const chunks = [];
  for (let index = 0; index < devices.length; index += fullStatusQueryLimit) {
    chunks.push(devices.slice(index, index + fullStatusQueryLimit));
  }
  let nextChunkIndex = 0;
  let firstError;
  const runWorker = async () => {
    while (requestId === listRequestId && nextChunkIndex < chunks.length) {
      const chunk = chunks[nextChunkIndex++];
      try {
        await refreshDeviceStatusBatch(chunk);
      } catch (error) {
        firstError ??= error;
      } finally {
        if (requestId === listRequestId) {
          statusProbeProgress.completed = Math.min(statusProbeProgress.completed + chunk.length, devices.length);
        }
      }
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(statusProbeConcurrency, chunks.length) }, () => runWorker())
    );
    if (firstError && requestId === listRequestId) {
      showToast(firstError.message || '设备在线状态检测失败', 'error');
    }
  } finally {
    if (requestId === listRequestId) {
      onlineStatusChecking.value = false;
      statusProbeProgress.completed = 0;
      statusProbeProgress.total = 0;
    }
  }
};

const load = async () => {
  const requestId = ++listRequestId;
  loading.value = true;
  onlineStatusChecking.value = false;
  statusProbeProgress.completed = 0;
  statusProbeProgress.total = 0;
  probedFilteredDevices.value = null;
  pageData.list.forEach(device => { device.onlineChecking = false; });
  if (!query.userId) {
    query.status = '';
    query.abnormalStatus = '';
  }
  try {
    const baseParams = {
      keyword: query.keyword,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(selectedGroupId.value ? { groupId: selectedGroupId.value } : {}),
    };
    if (query.sortBy) {
      baseParams.sortBy = query.sortBy;
      baseParams.sortOrder = query.sortOrder;
    }

    const needsLiveFilter = Boolean(query.userId && (query.status || query.abnormalStatus));
    if (needsLiveFilter) {
      const allDevices = await fetchAllScopedDevices(baseParams, requestId);
      if (requestId !== listRequestId) return;
      await probeDevicesInBatches(allDevices, requestId);
      if (requestId !== listRequestId) return;
      probedFilteredDevices.value = allDevices.filter((device) => {
        const isOnline = Number(device.online) === 1;
        if (query.status === 'online' && !isOnline) return false;
        if (query.status === 'offline' && isOnline) return false;
        if (query.abnormalStatus === 'normal' && !(isOnline && device.abnormalStatus === '无异常')) return false;
        if (query.abnormalStatus === 'abnormal' && !(isOnline && Boolean(device.hasAlarm))) return false;
        return true;
      });
      applyProbedPage();
      return;
    }

    const result = await api.get('/api/admin/devices', {
      ...baseParams,
      page: query.page,
      pageSize: query.pageSize,
    });
    if (requestId !== listRequestId) return;
    const lastPage = Math.max(result.totalPages, 1);
    if (query.page > lastPage) {
      query.page = lastPage;
      return load();
    }
    Object.assign(pageData, result);
    void refreshCurrentPageOnlineStatus([...pageData.list], requestId);
  } catch (error) {
    if (requestId === listRequestId) showToast(error.message, 'error');
  } finally {
    if (requestId === listRequestId) loading.value = false;
  }
};
const search = () => { query.page = 1; load(); };
const refreshCurrentPage = () => { load(); };
const changePage = (page) => {
  query.page = page;
  if (probedFilteredDevices.value !== null) {
    applyProbedPage();
    return;
  }
  load();
};
const changePageSize = (size) => {
  query.pageSize = size;
  query.page = 1;
  if (probedFilteredDevices.value !== null) {
    applyProbedPage();
    return;
  }
  load();
};
const toggleSort = (field) => {
  if (query.sortBy !== field) {
    query.sortBy = field;
    query.sortOrder = 'asc';
  } else if (query.sortOrder === 'asc') {
    query.sortOrder = 'desc';
  } else {
    query.sortBy = '';
    query.sortOrder = '';
  }
  search();
};
const getAriaSort = (field) => {
  if (query.sortBy !== field) return 'none';
  return query.sortOrder === 'desc' ? 'descending' : 'ascending';
};
const getSortTitle = (field) => {
  if (query.sortBy !== field) return '点击按名称升序排列';
  return query.sortOrder === 'asc' ? '当前升序，点击切换为降序' : '当前降序，点击恢复默认排序';
};
const openDetail = (device) => {
  if (device?.onlineChecking) {
    showToast('正在检测设备状态，请稍后进入', 'info');
    return;
  }
  if (getDeviceStatus(device).key === 'offline') {
    showToast('设备离线，无法进入详情', 'error');
    return;
  }
  setSelectedDevice(device);
  router.push({ name: 'device-detail', params: { deviceCode: device.deviceCode } });
};
const openDeviceForm = (device = null) => {
  deviceModal.editing = device;
  Object.assign(deviceForm, {
    deviceCode: device?.deviceCode || '',
    deviceName: device?.reportedDeviceName || '',
    remarkName: device?.remarkName || '',
  });
  deviceModal.visible = true;
};
const formatBattery = (value) => Number.isFinite(Number(value)) ? `${Number(value)}%` : '--';
const formatCurrent = (value) => Number.isFinite(Number(value)) ? `${Number(value)}A` : '--';
const formatSignalTitle = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? `CSQ ${Number(value)}`
  : '信号未知';
const getDeviceActionLabel = (device) => {
  if (device.actionLoading) return '操作中';
  if (device.controlState === 'running') return '暂停';
  if (device.controlState === 'paused') return '继续';
  if (device.controlState === 'idle') return '开始';
  return '不可操作';
};
const canControlDevice = (device) => getDeviceStatus(device).isOnline
  && !device.onlineChecking
  && !device.actionLoading
  && !['unknown', 'returning'].includes(device.controlState);
const handleDeviceAction = async (device) => {
  if (!canControlDevice(device)) return;
  const action = device.controlState === 'running' ? 'pause' : 'start';
  device.actionLoading = true;
  try {
    await api.post('/api/devices/command', {
      deviceCode: device.deviceCode,
      type: 'send',
      params: { data: action === 'pause' ? '$h=0' : '$h=1' },
      timeout: 10000,
    });
    device.controlState = action === 'pause' ? 'paused' : 'running';
    device.controlStateLabel = action === 'pause' ? '暂停' : '运行中';
    showToast(action === 'pause' ? '已下发暂停指令' : '已下发开始指令');
    await refreshCurrentPageOnlineStatus([device]);
  } catch (error) {
    showToast(error.message || '设备操作失败', 'error');
  } finally {
    device.actionLoading = false;
  }
};
const saveDevice = async () => {
  submitting.value = true;
  try {
    if (deviceModal.editing) await api.put(`/api/admin/devices/${deviceModal.editing.id}`, { remarkName: deviceForm.remarkName });
    else await api.post('/api/admin/devices', { ...deviceForm, deviceType: 'dtu' });
    deviceModal.visible = false; showToast(deviceModal.editing ? '设备信息已更新' : '设备已登记'); await load();
  } catch (error) { showToast(error.message, 'error'); }
  finally { submitting.value = false; }
};
const fetchAllUsers = async () => {
  const first = await api.get('/api/admin/users', { page: 1, pageSize: 100 });
  const list = [...first.list];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await api.get('/api/admin/users', { page, pageSize: 100 });
    list.push(...next.list);
  }
  return list;
};
const loadDeviceGroups = async () => {
  const requestId = ++groupRequestId;
  const userId = query.userId;
  groupsLoading.value = Boolean(userId);
  if (!userId) return;
  try {
    const groups = await api.get(`/api/admin/users/${userId}/device-groups`);
    if (requestId !== groupRequestId) return;
    deviceGroups.value = groups;
    if (selectedGroupId.value && !deviceGroups.value.some(group => group.id === Number(selectedGroupId.value))) selectedGroupId.value = '';
  } catch (error) {
    if (requestId === groupRequestId) showToast(error.message, 'error');
  } finally {
    if (requestId === groupRequestId) groupsLoading.value = false;
  }
};
const changeOwner = () => {
  selectedGroupId.value = '';
  query.status = '';
  query.abnormalStatus = '';
  probedFilteredDevices.value = null;
  deviceGroups.value = [];
  void loadDeviceGroups();
  search();
};
const openBind = async (device) => {
  try {
    users.value = await fetchAllUsers();
    if (!users.value.length) return showToast('暂无可分配的平台用户', 'error');
    bindModal.device = device; bindUserId.value = bindUserOptions.value[0].value; bindModal.visible = true;
  } catch (error) { showToast(error.message, 'error'); }
};
const bindDevice = async () => {
  submitting.value = true;
  try {
    await api.post(`/api/admin/devices/${bindModal.device.id}/bind`, { userId: bindUserId.value });
    bindModal.visible = false;
    showToast('设备分配成功，APP 与 PC 端将同步显示');
    await loadDeviceGroups();
    await load();
  }
  catch (error) { showToast(error.message, 'error'); }
  finally { submitting.value = false; }
};
const openUnbind = (device) => { unbindModal.device = device; unbindModal.visible = true; };
const unbindDevice = async () => {
  submitting.value = true;
  try {
    await api.post(`/api/admin/devices/${unbindModal.device.id}/unbind`);
    unbindModal.visible = false;
    showToast('设备已解绑，APP 端将同步移除');
    await loadDeviceGroups();
    await load();
  }
  catch (error) { showToast(error.message, 'error'); }
  finally { submitting.value = false; }
};
const openDelete = (device) => { deleteModal.device = device; deleteModal.visible = true; };
const deleteDevice = async () => {
  if (!deleteModal.device) return;

  submitting.value = true;
  try {
    await api.delete(`/api/admin/devices/${deleteModal.device.id}`);
    deleteModal.visible = false;
    deleteModal.device = null;
    if (pageData.list.length === 1 && query.page > 1) query.page -= 1;
    await loadDeviceGroups();
    showToast('设备已删除');
    await load();
  } catch (error) {
    showToast(error.message || '设备删除失败', 'error');
  } finally {
    submitting.value = false;
  }
};

onMounted(() => Promise.all([
  load(),
  fetchAllUsers()
    .then(list => { users.value = list; })
    .catch(error => showToast(error.message || '用户列表加载失败', 'error')),
]));
</script>

<style scoped>
.device-toolbar, .device-toolbar .filter-group { flex-wrap: wrap; }
.owner-filter { max-width: 200px; }
.table-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  margin-left: -6px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: pointer;
  transition: color .15s ease, background .15s ease;
}
.table-sort-btn:hover { color: var(--ink); background: rgba(49, 87, 229, .06); }
.table-sort-btn.active { color: var(--primary); }
.sort-caret {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}
.sort-caret i {
  display: block;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
}
.sort-caret i.up { border-bottom: 5px solid #c0c7d6; }
.sort-caret i.down { border-top: 5px solid #c0c7d6; }
.sort-caret i.up.active { border-bottom-color: var(--primary); }
.sort-caret i.down.active { border-top-color: var(--primary); }
</style>
