<template>
  <div v-if="loading" class="loading detail-loading">设备详情加载中...</div>
  <div v-else-if="!device" class="panel detail-error">
    <p>未找到该设备，设备可能已经被删除。</p>
    <button class="secondary-btn" type="button" @click="router.push({ name: 'devices' })">返回设备管理</button>
  </div>
  <div v-else class="device-detail-page">
    <section class="detail-hero">
      <button class="detail-back" type="button" @click="router.push({ name: 'devices' })">
        <span aria-hidden="true">←</span> 返回设备列表
      </button>
      <div class="detail-hero-main">
        <span class="detail-device-icon" aria-hidden="true">
          <AppIcon name="device" :size="27" />
          <i :class="{ online: device.online === 1 }"></i>
        </span>
        <div class="detail-identity">
          <div class="detail-title-row">
            <h2>{{ device.deviceName || device.deviceCode }}</h2>
            <span class="tag" :class="device.online === 1 ? 'success' : 'danger'">{{ device.online === 1 ? '在线' : '离线' }}</span>
            <span class="tag" :class="isBound ? 'success' : 'neutral'">{{ isBound ? '已绑定' : '未绑定' }}</span>
          </div>
          <p>{{ device.deviceCode }} · {{ typeLabel(device.deviceType) }} · {{ device.owner?.username || '暂无所属用户' }}<template v-if="deviceState.version"> · 固件 {{ deviceState.version }}</template></p>
        </div>
        <div class="detail-hero-actions">
          <button class="secondary-btn" type="button" :disabled="commandBusy || !isBound" @click="syncClock">同步时间</button>
          <button class="primary-btn" type="button" :disabled="commandBusy || !isBound" @click="refreshState">
            {{ refreshing ? '正在获取...' : '刷新设备数据' }}
          </button>
        </div>
      </div>
      <div v-if="!isBound" class="detail-warning">设备尚未绑定，实时状态和指令操作暂不可用。</div>
    </section>

    <nav class="detail-tabs" aria-label="设备功能">
      <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
        {{ tab.label }}
      </button>
    </nav>

    <template v-if="activeTab === 'status'">
      <div class="status-layout">
        <section class="status-overview panel">
          <div class="status-ring" :style="ringStyle">
            <div class="status-ring-core">
              <span>当前状态</span>
              <strong>{{ deviceState.deviceStatus }}</strong>
              <b>{{ deviceState.currentTrip }} <em>/ {{ deviceState.manualTripsVal }} 趟</em></b>
            </div>
          </div>
          <div class="status-summary">
            <div><span>设备时间</span><strong>{{ deviceState.deviceTime }}</strong></div>
            <div><span>运行模式</span><strong>{{ deviceState.runMode }}</strong></div>
            <div><span>风机状态</span><strong>{{ fanLabel }}</strong></div>
            <div><span>撒药状态</span><strong>{{ pumpLabel }}</strong></div>
          </div>
        </section>

        <section class="panel raw-response-panel">
          <div class="panel-header compact"><div><h2>最近设备回执</h2><p>接口返回的原始透传数据</p></div></div>
          <pre>{{ rawResponse || '刷新设备数据后将在这里显示设备回执' }}</pre>
        </section>
      </div>

      <section class="panel metric-panel">
        <div class="panel-header compact"><div><h2>运行参数</h2><p>数据来自设备状态查询指令 `$#`</p></div></div>
        <div class="metric-grid">
          <div v-for="item in metrics" :key="item.label" class="metric-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}<em v-if="item.unit">{{ item.unit }}</em></strong>
          </div>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'parameters'">
      <div class="settings-layout">
        <section class="panel settings-panel">
          <div class="panel-header compact"><div><h2>运行参数设置</h2><p>修改后点击对应参数的保存按钮，指令将直接下发到当前设备</p></div></div>
          <div class="parameter-grid">
            <div v-for="item in parameterFields" :key="item.key" class="parameter-field">
              <label :for="`parameter-${item.key}`">{{ item.label }}</label>
              <div class="parameter-control">
                <input :id="`parameter-${item.key}`" v-model="parameterForm[item.key]" type="number" :min="item.min" :max="item.max" :step="item.step">
                <span>{{ item.unit }}</span>
                <button type="button" :disabled="commandBusy || !isBound" @click="saveParameter(item)">保存</button>
              </div>
            </div>
            <div class="parameter-field">
              <label for="run-mode">运行模式</label>
              <div class="parameter-control">
                <select id="run-mode" v-model="parameterForm.runMode">
                  <option value="0">自动</option>
                  <option value="1">手动</option>
                </select>
                <button type="button" :disabled="commandBusy || !isBound" @click="saveRunMode">保存</button>
              </div>
            </div>
          </div>
        </section>

        <aside class="settings-side">
          <section class="panel side-card">
            <div class="panel-header compact"><div><h2>设备名称</h2><p>APP 与 PC 将同步显示新名称</p></div></div>
            <div class="side-card-body">
              <input v-model.trim="editableName" class="form-control" maxlength="100" placeholder="设备名称">
              <button class="primary-btn full-button" type="button" :disabled="savingName" @click="saveName">{{ savingName ? '保存中...' : '保存名称' }}</button>
            </div>
          </section>

          <section class="panel side-card">
            <div class="panel-header compact"><div><h2>透传指令</h2><p>向当前设备发送原始文本</p></div></div>
            <div class="side-card-body">
              <textarea v-model="customCommand" class="form-control custom-command" placeholder="例如：$#"></textarea>
              <button class="primary-btn full-button" type="button" :disabled="commandBusy || !isBound || !customCommand.trim()" @click="sendCustomCommand">发送指令</button>
              <pre v-if="customResponse" class="custom-response">{{ customResponse }}</pre>
            </div>
          </section>

          <section class="panel danger-zone">
            <div><strong>解除设备绑定</strong><p>解绑后 APP 用户将无法继续使用该设备。</p></div>
            <button class="danger-btn" type="button" :disabled="!isBound" @click="unbindModalVisible = true">解绑设备</button>
          </section>
        </aside>
      </div>
    </template>

    <template v-else>
      <section class="panel schedule-panel">
        <div class="panel-header schedule-header">
          <div><h2>自动定时配置</h2><p>对应 App 自动设置中的 `$H` 至 `$S` 共12组计划</p></div>
          <div class="toolbar-actions">
            <button class="secondary-btn" type="button" @click="loadDefaultSlots">载入默认配置</button>
            <button class="secondary-btn" type="button" @click="saveDefaultSlots">保存为默认</button>
            <button class="primary-btn" type="button" :disabled="commandBusy || !isBound" @click="saveAllSlots">{{ savingSlots ? '正在下发...' : '同步全部配置' }}</button>
          </div>
        </div>
        <div class="schedule-grid">
          <div v-for="(slot, index) in deviceState.timeSlots" :key="index" class="schedule-item">
            <div class="schedule-number"><span>{{ String(index + 1).padStart(2, '0') }}</span><small>${{ 'HIJKLMNOPQRS'[index] }}</small></div>
            <label><span>执行时间</span><input v-model="slot.time" type="time"></label>
            <label><span>运行趟数</span><input v-model.number="slot.trips" type="number" min="0" max="99" step="1"></label>
          </div>
        </div>
      </section>
    </template>

    <AppModal v-model="unbindModalVisible" title="解绑设备" confirm-text="确认解绑" danger :loading="unbinding" @confirm="unbindDevice">
      <p class="confirm-copy">确认解除 <strong>{{ device.deviceName || device.deviceCode }}</strong> 与用户 <strong>{{ device.owner?.username || '--' }}</strong> 的绑定吗？解绑后 APP 将同步移除该设备。</p>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import AppModal from '../components/AppModal.vue';
import { api } from '../services/api.js';
import { typeLabel } from '../utils/format.js';
import { showToast } from '../utils/toast.js';
import { createDeviceState, createSlotCommand, extractResponseText, getTimeCommand, parseDeviceResponse } from '../utils/deviceProtocol.js';

const DEFAULT_SLOTS_KEY = 'CKZS_ADMIN_DEVICE_SCHEDULE_DEFAULT';
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const refreshing = ref(false);
const commandBusy = ref(false);
const savingName = ref(false);
const savingSlots = ref(false);
const unbinding = ref(false);
const unbindModalVisible = ref(false);
const activeTab = ref('status');
const device = ref(null);
const rawResponse = ref('');
const customCommand = ref('');
const customResponse = ref('');
const editableName = ref('');
const deviceState = reactive(createDeviceState());
const parameterForm = reactive({
  nearWaitTime: 0,
  farWaitTime: 0,
  manualTripsVal: 0,
  feedTimeout: 0,
  softLimit: 0,
  feedSpeed: 0,
  motorTorque: 0,
  moveSpeed: 0,
  chargingTargetVoltage: 0,
  chargingCurrentLimit: 0,
  startMinimumVoltage: 0,
  autoShutdownTime: 0,
  runMode: '0',
});

const tabs = [
  { key: 'status', label: '实时状态' },
  { key: 'parameters', label: '参数设置' },
  { key: 'schedule', label: '定时配置' },
];

const parameterFields = [
  { key: 'nearWaitTime', label: '近端等待时间', unit: '秒', command: '$1=', min: 0, step: 1 },
  { key: 'farWaitTime', label: '远端等待时间', unit: '秒', command: '$2=', min: 0, step: 1 },
  { key: 'manualTripsVal', label: '手动模式趟数', unit: '趟', command: '$3=', min: 0, step: 1 },
  { key: 'feedTimeout', label: '喂食超时时间', unit: '秒', command: '$5=', min: 0, step: 1 },
  { key: 'softLimit', label: '距离软限位', unit: '米', command: '$7=', min: 0, step: 0.1, scale: 10 },
  { key: 'feedSpeed', label: '送料电机转速', unit: '圈/秒', command: '$8=', min: 0, step: 0.1, scale: 10 },
  { key: 'motorTorque', label: '送料电机扭矩', unit: '%', command: '$9=', min: 0, max: 100, step: 1 },
  { key: 'moveSpeed', label: '移动速度', unit: '%', command: '$a=', min: 50, max: 100, step: 1 },
  { key: 'chargingTargetVoltage', label: '充电目标电压', unit: 'V', command: '$d=', step: 0.01, scale: 100 },
  { key: 'chargingCurrentLimit', label: '充电电流限制', unit: 'A', command: '$e=', step: 0.001, scale: 1000 },
  { key: 'startMinimumVoltage', label: '启动最低电压', unit: 'V', command: '$f=', step: 0.01, scale: 100 },
  { key: 'autoShutdownTime', label: '自动关机时间', unit: 's', command: '$g=', step: 1 },
];

const isBound = computed(() => device.value?.status === 1 && Boolean(device.value?.userId));
const fanLabel = computed(() => deviceState.fanStatus === 'ON' ? '开启' : deviceState.fanStatus === 'OFF' ? '关闭' : '--');
const pumpLabel = computed(() => deviceState.pumpStatus === 'ON' ? '开启' : deviceState.pumpStatus === 'OFF' ? '关闭' : '--');
const progress = computed(() => deviceState.manualTripsVal > 0 ? Math.min((deviceState.currentTrip / deviceState.manualTripsVal) * 100, 100) : 0);
const ringStyle = computed(() => ({ background: `conic-gradient(#3157e5 ${progress.value}%, #e9edfa ${progress.value}% 100%)` }));
const metrics = computed(() => [
  { label: '近端等待时间', value: deviceState.nearWaitTime, unit: 's' },
  { label: '远端等待时间', value: deviceState.farWaitTime, unit: 's' },
  { label: '手动模式趟数', value: deviceState.manualTripsVal, unit: '趟' },
  { label: '喂食超时时间', value: deviceState.feedTimeout, unit: 's' },
  { label: '距离软限位', value: deviceState.softLimit > 0 ? deviceState.softLimit / 10 : '关闭', unit: deviceState.softLimit > 0 ? '米' : '' },
  { label: '送料电机转速', value: deviceState.feedSpeed / 10, unit: '圈/秒' },
  { label: '送料电机扭矩', value: deviceState.motorTorque, unit: '%' },
  { label: '移动速度', value: deviceState.moveSpeed, unit: '%' },
  { label: '充电目标电压', value: deviceState.chargingTargetVoltage / 100, unit: 'V' },
  { label: '充电电流限制', value: deviceState.chargingCurrentLimit / 1000, unit: 'A' },
  { label: '启动最低电压', value: deviceState.startMinimumVoltage / 100, unit: 'V' },
  { label: '自动关机时间', value: deviceState.autoShutdownTime, unit: 's' },
]);

const applyStateToForm = () => {
  Object.assign(parameterForm, {
    nearWaitTime: deviceState.nearWaitTime,
    farWaitTime: deviceState.farWaitTime,
    manualTripsVal: deviceState.manualTripsVal,
    feedTimeout: deviceState.feedTimeout,
    softLimit: deviceState.softLimit / 10,
    feedSpeed: deviceState.feedSpeed / 10,
    motorTorque: deviceState.motorTorque,
    moveSpeed: deviceState.moveSpeed,
    chargingTargetVoltage: deviceState.chargingTargetVoltage / 100,
    chargingCurrentLimit: deviceState.chargingCurrentLimit / 1000,
    startMinimumVoltage: deviceState.startMinimumVoltage / 100,
    autoShutdownTime: deviceState.autoShutdownTime,
    runMode: deviceState.runMode === '手动' ? '1' : '0',
  });
};

const loadDevice = async () => {
  loading.value = true;
  try {
    const deviceCode = String(route.params.deviceCode || '');
    const pageData = await api.get('/api/admin/devices', {
      page: 1,
      pageSize: 100,
      keyword: deviceCode,
    });
    device.value = pageData.list.find(item => item.deviceCode === deviceCode) || null;

    if (!device.value) throw new Error('未找到该设备');
    editableName.value = device.value.deviceName || device.value.deviceCode;
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    loading.value = false;
  }
};

const sendCommand = async (data, timeout = 10000) => {
  if (!device.value?.deviceCode) throw new Error('设备编码不存在');
  if (!isBound.value) throw new Error('设备未绑定，无法下发指令');
  return api.post('/api/devices/command', {
    deviceCode: device.value.deviceCode,
    type: 'send',
    params: { data },
    timeout,
  });
};

const refreshState = async () => {
  if (refreshing.value || !isBound.value) return;
  refreshing.value = true;
  commandBusy.value = true;
  try {
    const result = await sendCommand('$#');
    const parsed = parseDeviceResponse(result, deviceState);
    Object.assign(deviceState, parsed.state);
    rawResponse.value = parsed.text;
    applyStateToForm();
    showToast('设备数据已更新');
  } catch (error) {
    showToast(error.message || '设备数据获取失败', 'error');
  } finally {
    refreshing.value = false;
    commandBusy.value = false;
  }
};

const syncClock = async () => {
  if (commandBusy.value || !isBound.value) return;
  commandBusy.value = true;
  try {
    await sendCommand(getTimeCommand());
    showToast('设备时间已同步');
  } catch (error) {
    showToast(error.message || '时间同步失败', 'error');
  } finally {
    commandBusy.value = false;
  }
};

const saveParameter = async (field) => {
  const numericValue = Number(parameterForm[field.key]);
  if (!Number.isFinite(numericValue)) return showToast(`请输入正确的${field.label}`, 'error');
  if (field.min !== undefined && numericValue < field.min) return showToast(`${field.label}不能小于 ${field.min}`, 'error');
  if (field.max !== undefined && numericValue > field.max) return showToast(`${field.label}不能大于 ${field.max}`, 'error');
  const commandValue = Math.round(numericValue * (field.scale || 1));
  commandBusy.value = true;
  try {
    await sendCommand(`${field.command}${commandValue}`);
    showToast(`${field.label}已同步`);
  } catch (error) {
    showToast(error.message || '参数同步失败', 'error');
  } finally {
    commandBusy.value = false;
  }
};

const saveRunMode = async () => {
  commandBusy.value = true;
  try {
    await sendCommand(`$4=${parameterForm.runMode}`);
    deviceState.runMode = parameterForm.runMode === '1' ? '手动' : '自动';
    showToast('运行模式已同步');
  } catch (error) {
    showToast(error.message || '运行模式同步失败', 'error');
  } finally {
    commandBusy.value = false;
  }
};

const sendCustomCommand = async () => {
  const command = customCommand.value.trim();
  if (!command) return;
  commandBusy.value = true;
  try {
    const result = await sendCommand(command);
    customResponse.value = extractResponseText(result) || '设备已响应';
    showToast('透传指令已发送');
  } catch (error) {
    showToast(error.message || '指令发送失败', 'error');
  } finally {
    commandBusy.value = false;
  }
};

const saveName = async () => {
  const name = editableName.value.trim();
  if (!name) return showToast('设备名称不能为空', 'error');
  if (name === device.value.deviceName) return showToast('设备名称没有变化');
  savingName.value = true;
  try {
    const updated = await api.put(`/api/admin/devices/${device.value.id}`, {
      deviceName: name,
      deviceType: device.value.deviceType,
    });
    device.value = { ...device.value, ...updated };
    showToast('设备名称已保存，APP 端将同步显示');
  } catch (error) {
    showToast(error.message || '设备名称保存失败', 'error');
  } finally {
    savingName.value = false;
  }
};

const saveAllSlots = async () => {
  if (savingSlots.value || !isBound.value) return;
  savingSlots.value = true;
  commandBusy.value = true;
  try {
    for (let index = 0; index < deviceState.timeSlots.length; index += 1) {
      await sendCommand(createSlotCommand(deviceState.timeSlots[index], index));
    }
    showToast('12组定时配置已同步');
  } catch (error) {
    showToast(error.message || '定时配置同步失败', 'error');
  } finally {
    savingSlots.value = false;
    commandBusy.value = false;
  }
};

const saveDefaultSlots = () => {
  localStorage.setItem(DEFAULT_SLOTS_KEY, JSON.stringify(deviceState.timeSlots));
  showToast('当前定时配置已保存为本机默认');
};

const loadDefaultSlots = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(DEFAULT_SLOTS_KEY) || '[]');
    if (!Array.isArray(saved) || saved.length !== 12) return showToast('暂无可用的默认配置', 'error');
    deviceState.timeSlots = saved.map(item => ({ time: item.time || '00:00', trips: Number(item.trips) || 0 }));
    showToast('默认配置已载入，请确认后同步到设备');
  } catch {
    showToast('默认配置读取失败', 'error');
  }
};

const unbindDevice = async () => {
  unbinding.value = true;
  try {
    await api.post(`/api/admin/devices/${device.value.id}/unbind`);
    unbindModalVisible.value = false;
    showToast('设备已解绑，APP 端将同步移除');
    await router.replace({ name: 'devices' });
  } catch (error) {
    showToast(error.message || '设备解绑失败', 'error');
  } finally {
    unbinding.value = false;
  }
};

onMounted(async () => {
  await loadDevice();
  if (isBound.value) {
    try { await syncClock(); } catch { /* syncClock already reports errors */ }
    await refreshState();
  }
});
</script>

<style scoped>
.device-detail-page { display: grid; gap: 18px; }
.detail-loading { min-height: 420px; }
.detail-error { padding: 60px; text-align: center; }
.detail-error p { margin: 0 0 22px; color: var(--muted); }
.detail-hero { overflow: hidden; padding: 20px 24px 24px; border-radius: 18px; color: #fff; background: linear-gradient(135deg, #172c72 0%, #3157e5 70%, #426af0 100%); box-shadow: 0 16px 36px rgba(32, 62, 158, .2); }
.detail-back { display: inline-flex; align-items: center; gap: 8px; padding: 5px 0; border: 0; color: #dce4ff; background: transparent; font-size: 12px; }
.detail-back:hover { color: #fff; }
.detail-back span { font-size: 18px; }
.detail-hero-main { display: flex; align-items: center; gap: 17px; margin-top: 16px; }
.detail-device-icon { position: relative; width: 58px; height: 58px; display: grid; flex: 0 0 58px; place-items: center; border: 1px solid rgba(255,255,255,.22); border-radius: 16px; color: #fff; background: rgba(255,255,255,.12); }
.detail-device-icon i { position: absolute; right: -2px; bottom: -2px; width: 12px; height: 12px; border: 3px solid #3157e5; border-radius: 50%; background: #aeb7cd; }
.detail-device-icon i.online { background: #35d29a; }
.detail-identity { min-width: 0; flex: 1; }
.detail-title-row { display: flex; align-items: center; gap: 9px; }
.detail-title-row h2 { max-width: 460px; margin: 0; overflow: hidden; text-overflow: ellipsis; font-size: 24px; white-space: nowrap; }
.detail-title-row .tag { border: 1px solid rgba(255,255,255,.14); }
.detail-identity p { margin: 8px 0 0; color: #cbd6ff; font-size: 12px; }
.detail-hero-actions { display: flex; gap: 10px; }
.detail-hero-actions .secondary-btn { border-color: rgba(255,255,255,.22); color: #fff; background: rgba(255,255,255,.1); }
.detail-hero-actions .primary-btn { color: #284cc8; background: #fff; box-shadow: none; }
.detail-hero-actions button:disabled { cursor: not-allowed; opacity: .5; }
.detail-warning { margin-top: 18px; padding: 11px 14px; border: 1px solid rgba(255,218,158,.25); border-radius: 10px; color: #ffe1ae; background: rgba(255,180,61,.1); font-size: 12px; }
.detail-tabs { display: flex; gap: 6px; padding: 6px; border: 1px solid var(--line); border-radius: 13px; background: #fff; box-shadow: var(--shadow); }
.detail-tabs button { min-width: 128px; height: 40px; padding: 0 20px; border: 0; border-radius: 9px; color: #6c7689; background: transparent; font-size: 13px; font-weight: 650; }
.detail-tabs button:hover { color: var(--primary); background: #f6f8ff; }
.detail-tabs button.active { color: #fff; background: var(--primary); box-shadow: 0 7px 16px rgba(49,87,229,.18); }
.status-layout { display: grid; grid-template-columns: minmax(560px, 1.2fr) minmax(360px, .8fr); gap: 18px; }
.status-overview { min-height: 292px; display: grid; grid-template-columns: 260px 1fr; align-items: center; padding: 28px; }
.status-ring { width: 210px; height: 210px; display: grid; place-items: center; border-radius: 50%; transform: rotate(-90deg); }
.status-ring-core { width: 166px; height: 166px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 1px #edf0f7; transform: rotate(90deg); }
.status-ring-core span { color: var(--muted); font-size: 12px; }
.status-ring-core strong { margin-top: 8px; font-size: 22px; }
.status-ring-core b { margin-top: 11px; color: var(--primary); font-size: 17px; }
.status-ring-core em { color: var(--muted); font-size: 12px; font-style: normal; font-weight: 500; }
.status-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.status-summary div { min-height: 92px; padding: 18px; border: 1px solid #e8ebf2; border-radius: 13px; background: #fafbfe; }
.status-summary span, .status-summary strong { display: block; }
.status-summary span { color: var(--muted); font-size: 11px; }
.status-summary strong { margin-top: 10px; font-size: 16px; }
.panel-header.compact { min-height: 64px; padding: 15px 20px; }
.raw-response-panel { min-width: 0; }
.raw-response-panel pre { height: 228px; margin: 0; overflow: auto; padding: 18px 20px; color: #dce4ff; background: #111a31; font: 12px/1.75 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; word-break: break-all; }
.metric-panel { overflow: hidden; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
.metric-item { min-height: 112px; padding: 24px; border-right: 1px solid var(--line); }
.metric-item:nth-child(n + 5) { border-top: 1px solid var(--line); }
.metric-item:nth-child(4n) { border-right: 0; }
.metric-item span, .metric-item strong { display: block; }
.metric-item span { color: var(--muted); font-size: 12px; }
.metric-item strong { margin-top: 13px; font-size: 24px; }
.metric-item em { margin-left: 5px; color: var(--muted); font-size: 12px; font-style: normal; font-weight: 500; }
.settings-layout { display: grid; grid-template-columns: minmax(620px, 1.25fr) minmax(340px, .75fr); gap: 18px; align-items: stretch; }
.settings-panel { display: flex; overflow: hidden; flex-direction: column; }
.parameter-grid { display: grid; flex: 1; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, minmax(72px, 1fr)); gap: 14px 18px; align-items: center; padding: 18px 22px; }
.parameter-field { min-width: 0; }
.parameter-field label { display: block; margin-bottom: 8px; color: #556075; font-size: 12px; font-weight: 650; }
.parameter-control { min-height: 43px; display: flex; align-items: center; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
.parameter-control:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.parameter-control input, .parameter-control select { min-width: 0; height: 41px; flex: 1; padding: 0 12px; border: 0; outline: none; color: var(--ink); background: transparent; }
.parameter-control span { padding: 0 10px; color: var(--muted); font-size: 11px; white-space: nowrap; }
.parameter-control button { height: 31px; margin-right: 5px; padding: 0 11px; border: 0; border-radius: 7px; color: var(--primary); background: var(--primary-soft); font-size: 11px; font-weight: 700; }
.parameter-control button:disabled { cursor: not-allowed; opacity: .5; }
.settings-side { display: grid; gap: 14px; }
.side-card { overflow: hidden; }
.side-card-body { padding: 16px 20px 18px; }
.full-button { width: 100%; margin-top: 12px; }
.custom-command { height: 72px !important; }
.custom-response { max-height: 140px; margin: 12px 0 0; overflow: auto; padding: 12px; border-radius: 9px; color: #dce4ff; background: #111a31; font: 11px/1.65 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; word-break: break-all; }
.danger-zone { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 20px; border-color: #ffdede; }
.danger-zone strong { font-size: 13px; }
.danger-zone p { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
.danger-zone .danger-btn { flex: none; }
.schedule-panel { overflow: hidden; }
.schedule-header { min-height: 76px; }
.schedule-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 22px; }
.schedule-item { display: grid; grid-template-columns: 54px 1fr 1fr; align-items: end; gap: 12px; padding: 16px; border: 1px solid #e5e9f2; border-radius: 13px; background: #fbfcfe; }
.schedule-number { width: 48px; height: 48px; display: grid; place-items: center; align-content: center; border-radius: 12px; color: var(--primary); background: var(--primary-soft); }
.schedule-number span { font-size: 14px; font-weight: 800; }
.schedule-number small { margin-top: 2px; color: #8292c9; font-size: 9px; }
.schedule-item label > span { display: block; margin-bottom: 7px; color: var(--muted); font-size: 10px; }
.schedule-item input { width: 100%; height: 38px; padding: 0 9px; border: 1px solid var(--line); border-radius: 8px; outline: none; background: #fff; }
.schedule-item input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
@media (max-width: 1400px) {
  .status-layout, .settings-layout { grid-template-columns: 1fr; }
  .parameter-grid { grid-template-rows: none; }
  .schedule-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
