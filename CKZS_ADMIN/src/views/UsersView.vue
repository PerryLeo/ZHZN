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
        <input v-model.trim="query.keyword" placeholder="搜索用户账号" @keyup.enter="search">
      </div>
      <select v-model="query.role" class="filter-select"><option value="">全部角色</option><option value="user">APP 用户</option><option value="admin">管理员</option></select>
      <button class="secondary-btn" type="button" @click="search">查询</button>
    </div>
    <div class="toolbar-actions"><span class="account-total">共 <strong>{{ pageData.total }}</strong> 个平台账号</span></div>
  </div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>用户</th><th>角色</th><th>绑定设备</th><th>注册时间</th><th>更新时间</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-if="loading"><td colspan="6" class="empty-state">数据加载中...</td></tr>
        <tr v-else-if="!pageData.list.length"><td colspan="6" class="empty-state">暂无符合条件的用户</td></tr>
        <template v-else>
          <tr v-for="item in pageData.list" :key="item.id">
            <td><div class="device-cell"><span class="device-thumb user-list-avatar">{{ item.username.slice(0, 1).toUpperCase() }}</span><div><strong>{{ item.username }}</strong><span>UID: {{ item.id }}</span></div></div></td>
            <td><span class="role-tag" :class="{ user: item.role !== 'admin' }">{{ item.role === 'admin' ? '管理员' : 'APP 用户' }}</span></td>
            <td>
              <button class="count-link user-count-link" type="button" @click="openUserDevices(item)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="5" y="4" width="14" height="16" rx="2" />
                  <path d="M9 8h6M9 12h6M12 16h3" />
                  <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none" />
                </svg>
                {{ item.deviceCount }} 台
              </button>
            </td>
            <td>{{ formatTime(item.createdAt) }}</td><td>{{ formatTime(item.updatedAt) }}</td>
            <td><div class="row-actions"><button class="text-btn" type="button" @click="openUserDevices(item)">查看设备</button><button class="text-btn" type="button" @click="openReset(item)">重置密码</button></div></td>
          </tr>
        </template>
      </tbody>
    </table>
    <AppPagination :page="pageData.page" :total="pageData.total" :total-pages="pageData.totalPages" @change="changePage" />
  </div>

  <AppModal v-model="resetModal.visible" title="重置用户密码" confirm-text="确认操作" danger :loading="submitting" @confirm="resetPassword">
    <p class="confirm-copy">确认将用户 <strong>{{ resetModal.user?.username }}</strong> 的密码重置为默认密码 123456 吗？</p>
  </AppModal>

  <AppModal v-model="deviceModal.visible" :title="`${deviceModal.user?.username || ''} 的设备`" confirm-text="关闭" :show-cancel="false" @confirm="deviceModal.visible = false">
    <div v-if="deviceModal.loading" class="loading modal-loading">设备加载中...</div>
    <div v-else-if="!deviceModal.devices.length" class="empty-state">该用户暂无绑定设备</div>
    <div v-else class="user-device-list">
      <div
        v-for="device in deviceModal.devices"
        :key="device.id"
        class="user-device-item clickable"
        role="link"
        tabindex="0"
        @click="openDeviceDetail(device)"
        @keydown.enter="openDeviceDetail(device)"
      >
        <span class="device-thumb modal-device-thumb" aria-hidden="true"><AppIcon name="device" :size="20" /></span>
        <div><strong>{{ device.remarkName || '--' }}</strong><span>{{ device.deviceCode }}</span></div>
        <span class="tag" :class="device.online === 1 ? 'success' : 'danger'">{{ device.online === 1 ? '在线' : '离线' }}</span>
      </div>
    </div>
  </AppModal>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppModal from '../components/AppModal.vue';
import AppPagination from '../components/AppPagination.vue';
import { api } from '../services/api.js';
import { formatTime } from '../utils/format.js';
import { showToast } from '../utils/toast.js';
import AppIcon from '../components/AppIcon.vue';

const loading = ref(false);
const submitting = ref(false);
const query = reactive({ page: 1, pageSize: 10, keyword: '', role: '' });
const pageData = reactive({ list: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
const resetModal = reactive({ visible: false, user: null });
const deviceModal = reactive({ visible: false, loading: false, user: null, devices: [] });
const router = useRouter();

const load = async () => {
  loading.value = true;
  try { Object.assign(pageData, await api.get('/api/admin/users', query)); }
  catch (error) { showToast(error.message, 'error'); }
  finally { loading.value = false; }
};
const search = () => { query.page = 1; load(); };
const changePage = (page) => { query.page = page; load(); };
const openReset = (user) => { resetModal.user = user; resetModal.visible = true; };
const resetPassword = async () => {
  submitting.value = true;
  try { await api.post('/api/users/resetPassword', { username: resetModal.user.username }); resetModal.visible = false; showToast(`用户 ${resetModal.user.username} 的密码已重置`); }
  catch (error) { showToast(error.message, 'error'); }
  finally { submitting.value = false; }
};
const openUserDevices = async (user) => {
  deviceModal.user = user; deviceModal.devices = []; deviceModal.loading = true; deviceModal.visible = true;
  try { deviceModal.devices = (await api.get(`/api/admin/users/${user.id}/devices`)).devices; }
  catch (error) { showToast(error.message, 'error'); }
  finally { deviceModal.loading = false; }
};
const openDeviceDetail = (device) => {
  const detailDevice = {
    ...device,
    owner: device.owner || (deviceModal.user ? {
      id: deviceModal.user.id,
      username: deviceModal.user.username,
    } : null),
  };
  sessionStorage.setItem(`CKZS_ADMIN_DEVICE_${device.deviceCode}`, JSON.stringify(detailDevice));
  deviceModal.visible = false;
  router.push({ name: 'device-detail', params: { deviceCode: device.deviceCode } });
};

onMounted(load);
</script>
