<template>
  <div class="toolbar">
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
      <select v-model="selectedGroupId" class="filter-select group-filter" @change="selectGroup">
        <option value="">全部设备分组</option>
        <option v-for="group in deviceGroups" :key="group.id" :value="group.id">{{ group.name }}（{{ group.deviceCount }}）</option>
      </select>
      <select v-model="query.online" class="filter-select"><option value="">全部在线状态</option><option value="1">在线</option><option value="0">离线</option></select>
      <button class="secondary-btn" type="button" @click="search">查询</button>
      <span v-if="onlineStatusChecking" class="online-checking-hint"><i></i>正在检测当前页设备在线状态...</span>
    </div>
    <div class="toolbar-actions">
      <button class="secondary-btn" type="button" @click="openGroupModal">+ 新建设备分组</button>
      <button class="primary-btn" type="button" @click="openDeviceForm()">+ 登记设备</button>
    </div>
  </div>

  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>设备信息</th><th>设备类型</th><th>所属用户</th><th>在线状态</th><th>绑定状态</th><th>更新时间</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-if="loading"><td colspan="7" class="empty-state">数据加载中...</td></tr>
        <tr v-else-if="!pageData.list.length"><td colspan="7" class="empty-state">暂无符合条件的设备</td></tr>
        <template v-else>
          <tr v-for="item in pageData.list" :key="item.id" :class="{ 'clickable-row': item.online === 1 && !item.onlineChecking, 'device-row-disabled': item.online !== 1 || item.onlineChecking }" @click="openDetail(item)">
            <td>
              <div class="device-cell">
                <span class="device-thumb device-asset-thumb" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="7" y="7" width="10" height="10" rx="2" />
                    <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" />
                    <path d="M10 10h4v4h-4z" />
                  </svg>
                  <i :class="{ online: item.online === 1, checking: item.onlineChecking }"></i>
                </span>
                <div><strong>{{ item.deviceName || item.deviceCode }}</strong><span>{{ item.deviceCode }}</span></div>
              </div>
            </td>
            <td>{{ typeLabel(item.deviceType) }}</td><td>{{ item.owner?.username || '--' }}</td>
            <td><span class="tag" :class="item.onlineChecking ? 'checking' : item.online === 1 ? 'success' : 'danger'">{{ item.onlineChecking ? '检测中' : item.online === 1 ? '在线' : '离线' }}</span></td>
            <td><span class="tag" :class="item.status === 1 ? 'success' : 'neutral'">{{ item.status === 1 ? '已绑定' : '未绑定' }}</span></td>
            <td>{{ formatTime(item.updatedAt) }}</td>
            <td><div class="row-actions"><button class="text-btn" type="button" @click.stop="openDetail(item)">查看详情</button><button class="text-btn" type="button" @click.stop="openDeviceForm(item)">编辑</button><button v-if="item.status === 1" class="text-btn danger" type="button" @click.stop="openUnbind(item)">解绑</button><template v-else><button class="text-btn" type="button" @click.stop="openBind(item)">绑定</button><button class="text-btn danger" type="button" @click.stop="openDelete(item)">删除</button></template></div></td>
          </tr>
        </template>
      </tbody>
    </table>
    <AppPagination :page="pageData.page" :total="pageData.total" :total-pages="pageData.totalPages" @change="changePage" />
  </div>

  <AppModal v-model="deviceModal.visible" :title="deviceModal.editing ? '编辑设备' : '登记设备'" :loading="submitting" @confirm="saveDevice">
    <div class="form-field"><label>设备编码</label><input v-model.trim="deviceForm.deviceCode" class="form-control" :disabled="Boolean(deviceModal.editing)" placeholder="请输入设备唯一编码" required></div>
    <div class="form-field"><label>设备名称</label><input v-model.trim="deviceForm.deviceName" class="form-control" placeholder="请输入设备名称" required></div>
    <div class="form-field"><label>设备类型</label><select v-model="deviceForm.deviceType" class="form-control"><option v-for="type in deviceTypes" :key="type" :value="type">{{ typeLabel(type) }}</option></select></div>
  </AppModal>

  <AppModal v-model="bindModal.visible" title="分配设备" confirm-text="确认分配" :loading="submitting" @confirm="bindDevice">
    <p class="confirm-copy">为设备 <strong>{{ bindModal.device?.deviceName || bindModal.device?.deviceCode }}</strong> 选择平台所属用户，APP 与 PC 端将同步显示。</p>
    <div class="form-field bind-user-field"><label>目标用户</label><select v-model.number="bindUserId" class="form-control"><option v-for="user in users" :key="user.id" :value="user.id">{{ user.username }}（{{ user.deviceCount }} 台设备）</option></select></div>
  </AppModal>

  <AppModal v-model="unbindModal.visible" title="解绑设备" confirm-text="确认操作" danger :loading="submitting" @confirm="unbindDevice">
    <p class="confirm-copy">确认解除 <strong>{{ unbindModal.device?.deviceName || unbindModal.device?.deviceCode }}</strong> 与用户 <strong>{{ unbindModal.device?.owner?.username }}</strong> 的绑定吗？APP 将同步失去该设备。</p>
  </AppModal>

  <AppModal v-model="deleteModal.visible" title="删除设备" confirm-text="确认删除" danger :loading="submitting" @confirm="deleteDevice">
    <p class="confirm-copy">确认永久删除设备 <strong>{{ deleteModal.device?.deviceName || deleteModal.device?.deviceCode }}</strong> 吗？设备资料删除后无法恢复。</p>
  </AppModal>

  <AppModal v-model="groupModal.visible" title="新建设备分组" confirm-text="创建分组" :loading="groupModal.submitting" @confirm="createDeviceGroup">
    <div class="form-field">
      <label>分组名称</label>
      <input v-model.trim="groupModal.name" class="form-control" maxlength="50" placeholder="请输入分组名称">
    </div>
    <div class="group-picker-header">
      <div><strong>选择设备</strong><span>仅展示已绑定设备，同一设备可加入多个分组</span></div>
      <b>已选 {{ selectedGroupDeviceIds.length }} 台</b>
    </div>
    <div v-if="groupModal.loadingDevices" class="loading group-picker-loading">设备加载中...</div>
    <div v-else-if="!boundDevices.length" class="empty-state group-picker-empty">暂无可分组的已绑定设备</div>
    <div v-else class="group-device-picker">
      <label v-for="device in boundDevices" :key="device.id" class="group-device-option" :class="{ selected: selectedGroupDeviceIds.includes(device.id) }">
        <input v-model="selectedGroupDeviceIds" type="checkbox" :value="device.id">
        <span class="device-thumb device-asset-thumb" aria-hidden="true">
          <AppIcon name="device" :size="19" />
          <i :class="{ online: device.online === 1 }"></i>
        </span>
        <span class="group-device-copy">
          <strong>{{ device.deviceName || device.deviceCode }}</strong>
          <small>{{ device.deviceCode }} · {{ device.owner?.username || '暂无所属用户' }}</small>
        </span>
        <span class="tag" :class="device.online === 1 ? 'success' : 'danger'">{{ device.online === 1 ? '在线' : '离线' }}</span>
      </label>
    </div>
  </AppModal>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import AppModal from '../components/AppModal.vue';
import AppPagination from '../components/AppPagination.vue';
import { api } from '../services/api.js';
import { formatTime, typeLabel } from '../utils/format.js';
import { showToast } from '../utils/toast.js';

const deviceTypes = ['dtu', 'sensor', 'gateway', 'camera', 'controller'];
const loading = ref(false);
const submitting = ref(false);
const onlineStatusChecking = ref(false);
const query = reactive({ page: 1, pageSize: 10, keyword: '', online: '' });
const pageData = reactive({ list: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
const deviceModal = reactive({ visible: false, editing: null });
const bindModal = reactive({ visible: false, device: null });
const unbindModal = reactive({ visible: false, device: null });
const deleteModal = reactive({ visible: false, device: null });
const deviceForm = reactive({ deviceCode: '', deviceName: '', deviceType: 'dtu' });
const users = ref([]);
const bindUserId = ref(null);
const deviceGroups = ref([]);
const selectedGroupId = ref('');
const boundDevices = ref([]);
const selectedGroupDeviceIds = ref([]);
const groupModal = reactive({ visible: false, name: '', loadingDevices: false, submitting: false });
const router = useRouter();
let onlineStatusRequestId = 0;

const refreshCurrentPageOnlineStatus = async (devices) => {
  const currentDevices = Array.isArray(devices) ? devices : [];
  if (!currentDevices.length) return;
  const requestId = ++onlineStatusRequestId;
  onlineStatusChecking.value = true;
  try {
    const result = await api.post('/api/devices/batchQueryStatus', {
      deviceCodes: currentDevices.map(device => device.deviceCode),
      timeout: 5000,
    });
    const statusMap = new Map((result?.results || []).map(item => [item.deviceCode, item.success]));
    currentDevices.forEach(device => {
      device.online = statusMap.get(device.deviceCode) === true ? 1 : 0;
      device.onlineChecking = false;
    });
  } catch (error) {
    currentDevices.forEach(device => {
      device.online = 0;
      device.onlineChecking = false;
    });
    throw error;
  } finally {
    if (requestId === onlineStatusRequestId) onlineStatusChecking.value = false;
  }
};
const load = async () => {
  loading.value = true;
  try {
    const params = {
      ...query,
      ...(selectedGroupId.value ? { groupId: selectedGroupId.value } : {}),
    };
    Object.assign(pageData, await api.get('/api/admin/devices', params));

    const currentDevices = [...pageData.list];
    currentDevices.forEach(device => {
      device.online = 0;
      device.onlineChecking = true;
    });
    refreshCurrentPageOnlineStatus(currentDevices).catch(error => {
      showToast(error.message || '设备在线状态检测失败', 'error');
    });
  }
  catch (error) { showToast(error.message, 'error'); }
  finally { loading.value = false; }
};
const search = () => { query.page = 1; load(); };
const selectGroup = () => { query.page = 1; load(); };
const changePage = (page) => { query.page = page; load(); };
const openDetail = (device) => {
  if (device?.onlineChecking) {
    showToast('正在检测设备状态，请稍后进入', 'info');
    return;
  }
  if (device?.online !== 1) {
    showToast('设备离线，无法进入详情', 'error');
    return;
  }
  router.push({ name: 'device-detail', params: { deviceCode: device.deviceCode } });
};
const openDeviceForm = (device = null) => {
  deviceModal.editing = device;
  Object.assign(deviceForm, device ? { deviceCode: device.deviceCode, deviceName: device.deviceName || '', deviceType: device.deviceType || 'dtu' } : { deviceCode: '', deviceName: '', deviceType: 'dtu' });
  deviceModal.visible = true;
};
const saveDevice = async () => {
  submitting.value = true;
  try {
    if (deviceModal.editing) await api.put(`/api/admin/devices/${deviceModal.editing.id}`, deviceForm);
    else await api.post('/api/admin/devices', deviceForm);
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
  try {
    deviceGroups.value = await api.get('/api/device-groups');
    if (selectedGroupId.value && !deviceGroups.value.some(group => group.id === Number(selectedGroupId.value))) selectedGroupId.value = '';
  } catch (error) {
    showToast(error.message, 'error');
  }
};
const fetchAllBoundDevices = async () => {
  const first = await api.get('/api/admin/devices', { page: 1, pageSize: 100, status: 1 });
  const list = [...first.list];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await api.get('/api/admin/devices', { page, pageSize: 100, status: 1 });
    list.push(...next.list);
  }
  return list;
};
const openGroupModal = async () => {
  groupModal.visible = true;
  groupModal.name = '';
  groupModal.loadingDevices = true;
  selectedGroupDeviceIds.value = [];
  try {
    boundDevices.value = await fetchAllBoundDevices();
    if (!boundDevices.value.length) showToast('暂无可分组的已绑定设备', 'error');
  } catch (error) {
    boundDevices.value = [];
    showToast(error.message, 'error');
  } finally {
    groupModal.loadingDevices = false;
  }
};
const createDeviceGroup = async () => {
  const name = groupModal.name.trim();
  if (!name) return showToast('请输入分组名称', 'error');
  if (!selectedGroupDeviceIds.value.length) return showToast('请至少选择一台设备', 'error');

  groupModal.submitting = true;
  try {
    const created = await api.post('/api/device-groups', {
      name,
      deviceIds: selectedGroupDeviceIds.value,
    });
    await loadDeviceGroups();
    selectedGroupId.value = created?.id || '';
    query.page = 1;
    groupModal.visible = false;
    showToast('分组创建成功');
    await load();
  } catch (error) {
    showToast(error.message || '分组创建失败', 'error');
  } finally {
    groupModal.submitting = false;
  }
};
const openBind = async (device) => {
  try {
    users.value = await fetchAllUsers();
    if (!users.value.length) return showToast('暂无可分配的平台用户', 'error');
    bindModal.device = device; bindUserId.value = users.value[0].id; bindModal.visible = true;
  } catch (error) { showToast(error.message, 'error'); }
};
const bindDevice = async () => {
  submitting.value = true;
  try { await api.post(`/api/admin/devices/${bindModal.device.id}/bind`, { userId: bindUserId.value }); bindModal.visible = false; showToast('设备分配成功，APP 与 PC 端将同步显示'); await load(); }
  catch (error) { showToast(error.message, 'error'); }
  finally { submitting.value = false; }
};
const openUnbind = (device) => { unbindModal.device = device; unbindModal.visible = true; };
const unbindDevice = async () => {
  submitting.value = true;
  try { await api.post(`/api/admin/devices/${unbindModal.device.id}/unbind`); unbindModal.visible = false; showToast('设备已解绑，APP 端将同步移除'); await load(); }
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

onMounted(() => Promise.all([load(), loadDeviceGroups()]));
</script>
