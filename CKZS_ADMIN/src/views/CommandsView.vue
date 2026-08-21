<template>
  <div v-if="loading" class="loading">设备数据加载中...</div>
  <div v-else class="command-layout">
    <section class="panel">
      <div class="panel-header"><div><h2>选择目标设备</h2><p>仅显示已绑定设备，请选择 1 台</p></div><span class="role-tag">{{ selectedCode ? '已选 1 台' : '未选择' }}</span></div>
      <div class="device-selector">
        <label v-for="item in devices" :key="item.id" class="select-device" :class="{ selected: selectedCode === item.deviceCode }">
          <input v-model="selectedCode" class="command-device-checkbox" type="radio" name="command-target-device" :value="item.deviceCode">
          <span><strong>{{ item.deviceName || item.deviceCode }}</strong><span>{{ item.deviceCode }} · {{ item.owner?.username || '未分配用户' }}</span></span>
          <span class="tag" :class="item.online === 1 ? 'success' : 'danger'">{{ item.online === 1 ? '在线' : '离线' }}</span>
        </label>
        <div v-if="!devices.length" class="empty-state">暂无已绑定设备</div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-header"><div><h2>下发设备指令</h2><p>指令将下发至选中设备并等待硬件回执</p></div></div>
      <form class="command-form" @submit.prevent="openConfirm">
        <div class="command-type-fixed"><span>指令类型</span><strong>透传指令（send）</strong></div>
        <div class="form-field"><label>透传内容</label><textarea v-model="form.payload" class="form-control" placeholder="请输入需要下发的透传内容，例如：$#"></textarea></div>
        <div class="command-tip">操作会直接通过现有 MQTT 服务下发到真实设备，并等待该设备回执，请确认设备和指令内容无误。</div>
        <button class="primary-btn command-submit" type="submit" :disabled="sending">{{ sending ? '指令下发中...' : '确认下发指令' }}</button>
        <pre v-if="result" class="command-result">{{ result }}</pre>
      </form>
    </section>
  </div>

  <AppModal v-model="confirmVisible" title="确认下发指令" confirm-text="确认下发" :loading="sending" @confirm="sendCommand">
    <p class="confirm-copy">即将向设备 <strong>{{ selectedCode || '--' }}</strong> 下发 <strong>透传指令（send）</strong>。该操作会触发真实硬件，请确认后继续。</p>
  </AppModal>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import AppModal from '../components/AppModal.vue';
import { api } from '../services/api.js';
import { showToast } from '../utils/toast.js';

const loading = ref(true);
const sending = ref(false);
const devices = ref([]);
const selectedCode = ref('');
const confirmVisible = ref(false);
const result = ref('');
const form = reactive({ payload: '' });
const commandType = 'send';

const fetchDevices = async () => {
  try {
    const first = await api.get('/api/admin/devices', { page: 1, pageSize: 100, status: 1 });
    const list = [...first.list];
    for (let page = 2; page <= first.totalPages; page += 1) {
      const next = await api.get('/api/admin/devices', { page, pageSize: 100, status: 1 });
      list.push(...next.list);
    }
    devices.value = list;
  } catch (error) { showToast(error.message, 'error'); }
  finally { loading.value = false; }
};
const getParams = () => {
  if (!form.payload.trim()) throw new Error('请输入透传内容');
  return { data: form.payload.trim() };
};
const openConfirm = () => {
  if (!selectedCode.value) return showToast('请选择一台设备', 'error');
  try { getParams(); confirmVisible.value = true; }
  catch (error) { showToast(error.message, 'error'); }
};
const sendCommand = async () => {
  sending.value = true;
  try {
    const params = getParams();
    const data = await api.post('/api/devices/command', { deviceCode: selectedCode.value, type: commandType, params, timeout: 10000 });
    result.value = JSON.stringify(data, null, 2);
    confirmVisible.value = false;
    showToast('指令下发成功');
  } catch (error) {
    result.value = `ERROR: ${error.message}`;
    showToast(error.message, 'error');
  } finally { sending.value = false; }
};

onMounted(fetchDevices);
</script>
