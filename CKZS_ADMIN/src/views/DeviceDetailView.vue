<template>
  <div v-if="loading" class="loading detail-loading">设备详情加载中...</div>
  <div v-else-if="!device" class="panel detail-error">
    <p>未找到该设备，设备可能已经被删除。</p>
    <button class="secondary-btn" type="button" @click="router.push({ name: 'devices' })">返回设备管理</button>
  </div>
  <div v-else class="device-detail-page" :class="`detail-tab-${activeTab}`">
    <section class="detail-hero">
      <button class="detail-back" type="button" @click="router.push({ name: 'devices' })">
        <span aria-hidden="true">←</span> 返回设备列表
      </button>
      <div class="detail-hero-main">
        <span class="detail-device-icon" aria-hidden="true">
          <AppIcon name="device" :size="27" />
          <i :class="{ online: deviceStatus.isOnline }"></i>
        </span>
        <div class="detail-device-info">
          <div class="detail-title-row">
          <h2>{{ device.remarkName || '--' }}</h2>
            <span class="tag" :class="abnormalStatusTone">{{ deviceState.abnormalStatus }}</span>
          </div>
        </div>
        <div class="detail-hero-actions">
          <button class="secondary-btn" type="button" :disabled="commandBusy || !canDeviceControl" @click="handleDeviceControl">{{ getDeviceControlLabel }}</button>
          <button class="secondary-btn" type="button" :disabled="commandBusy || !canOperate" @click="syncClock">同步时间</button>
          <button class="primary-btn" type="button" :disabled="commandBusy || !canOperate" @click="refreshState">
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
              <time>{{ deviceState.deviceTime }}</time>
              <span>当前状态</span>
              <strong>{{ deviceState.deviceStatus }}</strong>
              <b>{{ deviceState.currentTrip }} <em>/ {{ deviceState.manualTripsVal }} 趟</em></b>
            </div>
          </div>
          <div class="status-summary">
            <div><span>充电器电压</span><strong>{{ formatRealtimeValue(deviceState.chargerVoltage, 'V') }}</strong></div>
            <div><span>电池电压</span><strong>{{ formatRealtimeValue(deviceState.batteryVoltage, 'V') }}</strong></div>
            <div><span>电量</span><strong>{{ formatRealtimeValue(deviceState.batteryLevel, '%') }}</strong></div>
            <div><span>充电电流</span><strong>{{ formatRealtimeValue(deviceState.chargingCurrent, 'A') }}</strong></div>
          </div>
        </section>

        <section class="panel raw-response-panel">
          <div class="panel-header compact">
            <div><h2>最近设备回执</h2><p>接口返回的原始透传数据</p></div>
            <CopyResponseButton class="response-copy-btn" :text="rawResponse" />
          </div>
          <pre>{{ rawResponse || '刷新设备数据后将在这里显示设备回执' }}</pre>
        </section>
      </div>

      <section class="panel metric-panel">
        <div class="panel-header compact"><div><h2>运行参数</h2><p>数据来自设备状态查询指令 `$#`</p></div></div>
        <div class="metric-grid run-metric-grid">
          <div v-for="item in metrics" :key="item.label" class="metric-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}<em v-if="item.unit">{{ item.unit }}</em></strong>
          </div>
        </div>
      </section>
      <section class="panel metric-panel device-state-panel">
        <div class="panel-header compact"><div><h2>设备状态</h2></div></div>
        <div class="metric-grid device-status-grid">
          <div class="metric-item"><span>运行模式</span><strong>{{ deviceState.runMode }}</strong></div>
          <div class="metric-item"><span>风扇</span><strong>{{ fanLabel }}</strong></div>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'parameters'">
      <div class="settings-layout">
        <section class="panel settings-panel">
          <div class="panel-header compact"><div><h2>运行参数设置</h2><p>修改后点击对应参数的保存按钮，指令将直接下发到当前设备</p></div></div>
          <div class="parameter-grid">
            <div v-for="item in parameterFields" :key="item.key" class="parameter-field">
              <template v-if="item.key === 'defogTime'">
                <label for="defog-time">自动除雾时间（{{ formatDefogTime(deviceState.defogTime) }}）</label>
                <div class="parameter-control">
                  <input id="defog-time" v-model="defogTimeInput" type="time" min="00:01" max="23:59">
                  <button type="button" :disabled="commandBusy || !canOperate" @click="saveDefogTime()">保存</button>
                  <button type="button" :disabled="commandBusy || !canOperate" @click="saveDefogTime(true)">关闭</button>
                </div>
              </template>
              <template v-else>
                <label :for="`parameter-${item.key}`">{{ item.label }}</label>
                <div class="parameter-control">
                  <input :id="`parameter-${item.key}`" v-model="parameterForm[item.key]" type="number" :min="item.min" :max="item.max" :step="item.step">
                  <span>{{ item.unit }}</span>
                  <button type="button" :disabled="commandBusy || !canOperate" @click="saveParameter(item)">保存</button>
                </div>
              </template>
            </div>
            <div class="parameter-field">
              <label for="run-mode">运行模式</label>
              <div class="parameter-control">
                <AppSearchSelect id="run-mode" v-model="parameterForm.runMode" class="run-mode-select" label="运行模式" :options="runModeOptions" />
                <button type="button" :disabled="commandBusy || !canOperate" @click="saveRunMode">保存</button>
              </div>
            </div>
          </div>
        </section>

        <aside class="settings-side">
          <section class="panel side-card">
            <div class="panel-header compact"><div><h2>设备备注名称</h2><p>APP 与 PC 将同步显示该备注名称</p></div></div>
            <div class="side-card-body">
              <input v-model.trim="editableName" class="form-control" maxlength="100" placeholder="请输入备注名称">
              <button class="primary-btn full-button" type="button" :disabled="savingName" @click="saveName">{{ savingName ? '保存中...' : '保存备注' }}</button>
              <span class="readonly-device-name">设备初始名称：{{ device.reportedDeviceName || '--' }}</span>
              <span class="readonly-device-name">设备固件版本：{{ deviceState.version || '--' }}</span>
            </div>
          </section>

          <section class="panel side-card">
            <div class="panel-header compact"><div><h2>透传指令</h2><p>向当前设备发送原始文本</p></div></div>
            <div class="side-card-body">
              <textarea v-model="customCommand" class="form-control custom-command" placeholder="例如：$#"></textarea>
              <button class="primary-btn full-button" type="button" :disabled="commandBusy || !canOperate || !customCommand.trim()" @click="sendCustomCommand">发送指令</button>
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
            <button class="primary-btn" type="button" :disabled="commandBusy || !canOperate" @click="saveAllSlots">{{ savingSlots ? '正在下发...' : '同步全部配置' }}</button>
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
      <p class="confirm-copy">确认解除 <strong>{{ device.remarkName || '--' }}</strong> 与用户 <strong>{{ device.owner?.username || '--' }}</strong> 的绑定吗？解绑后 APP 将同步移除该设备。</p>
    </AppModal>
    <AppModal v-model="moveSpeedConfirmVisible" title="确认下发移动速度" confirm-text="仍要下发" @confirm="confirmMoveSpeed">
      <p class="confirm-copy">当前值为 <strong>{{ pendingMoveSpeed }}%</strong>，超出常用范围 50–100%，确认仍要下发吗？</p>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';
import AppModal from '../components/AppModal.vue';
import AppSearchSelect from '../components/AppSearchSelect.vue';
import { api } from '../services/api.js';
import { getSelectedDevice } from '../services/deviceNavigation.js';
import { getDeviceStatus } from '../utils/deviceStatus.js';
import { showToast } from '../utils/toast.js';
import CopyResponseButton from '../components/CopyResponseButton.vue';
import { createDeviceState, createSlotCommand, extractResponseText, getTimeCommand, parseDeviceResponse, formatDefogTime, encodeDefogTime } from '../utils/deviceProtocol.js';

const DEFAULT_SLOTS_KEY = 'CKZS_ADMIN_DEVICE_SCHEDULE_DEFAULT';
const runModeOptions = [
  { value: '0', label: '自动' },
  { value: '1', label: '手动' },
];
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const refreshing = ref(false);
const commandBusy = ref(false);
const savingName = ref(false);
const savingSlots = ref(false);
const unbinding = ref(false);
const unbindModalVisible = ref(false);
const moveSpeedConfirmVisible = ref(false);
const pendingMoveSpeed = ref(null);
const activeTab = ref('status');
const device = ref(null);
const rawResponse = ref('');
const customCommand = ref('');
const customResponse = ref('');
const editableName = ref('');
const defogTimeInput = ref('05:00');
const deviceState = reactive(createDeviceState());
const parameterForm = reactive({
  nearWaitTime: 0,
  farWaitTime: 0,
  manualTripsVal: 0,
  softLimit: 0,
  feedSpeed: 0,
  motorTorque: 0,
  moveSpeed: 0,
  chargingTargetVoltage: 0,
  chargingCurrentLimit: 0,
  startMinimumVoltage: 0,
  autoShutdownTime: 0,
  translationWaitTime: '',
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
  { key: 'softLimit', label: '软限位距离', unit: '米', command: '$7=', min: 0, max: 100, step: 0.01, scale: 100 },
  { key: 'feedSpeed', label: '送料电机转速', unit: '圈/秒', command: '$8=', min: 0, step: 0.1, scale: 10 },
  { key: 'motorTorque', label: '送料电机扭矩', unit: '%', command: '$9=', min: 0, max: 100, step: 1 },
  { key: 'moveSpeed', label: '移动速度', unit: '%', command: '$a=', step: 1 },
  { key: 'chargingTargetVoltage', label: '充电目标电压', unit: 'V', command: '$d=', step: 0.01, scale: 100 },
  { key: 'chargingCurrentLimit', label: '充电电流预警', unit: 'A', command: '$e=', step: 0.001, scale: 1000 },
  { key: 'startMinimumVoltage', label: '启动最低电压', unit: 'V', command: '$f=', step: 0.01, scale: 100 },
  { key: 'autoShutdownTime', label: '自动关机时间', unit: '分钟', command: '$g=', step: 1 },
  { key: 'defogTime', label: '自动除雾时间' },
  { key: 'translationWaitTime', label: '平移等待时间', unit: '秒', command: '$k=', min: 0, step: 1 },
];

const isBound = computed(() => device.value?.status === 1 && Boolean(device.value?.userId));
const deviceStatus = computed(() => getDeviceStatus(device.value));
const canOperate = computed(() => isBound.value && deviceStatus.value.isOnline);
const canDeviceControl = computed(() => canOperate.value && !['unknown', 'returning'].includes(deviceState.controlState));
const abnormalStatusTone = computed(() => {
  if (deviceState.hasAlarm) return 'danger';
  return deviceState.abnormalStatus === '--' ? 'neutral' : 'success';
});
const getDeviceControlLabel = computed(() => {
  if (commandBusy.value) return '操作中...';
  if (deviceState.controlState === 'running') return '暂停运行';
  if (deviceState.controlState === 'paused') return '继续运行';
  if (deviceState.controlState === 'idle') return '开始运行';
  return '不可操作';
});
const fanLabel = computed(() => deviceState.fanStatus === 'ON' ? '开启' : deviceState.fanStatus === 'OFF' ? '关闭' : '未知');
const progress = computed(() => deviceState.manualTripsVal > 0 ? Math.min((deviceState.currentTrip / deviceState.manualTripsVal) * 100, 100) : 0);
const ringStyle = computed(() => ({ background: `conic-gradient(#3157e5 ${progress.value}%, #e9edfa ${progress.value}% 100%)` }));
const metrics = computed(() => [
  { label: '近端等待时间', value: deviceState.nearWaitTime, unit: '秒' },
  { label: '远端等待时间', value: deviceState.farWaitTime, unit: '秒' },
  { label: '手动模式趟数', value: deviceState.manualTripsVal, unit: '趟' },
  { label: '软限位距离', value: deviceState.softLimit > 0 ? (deviceState.softLimit / 100).toFixed(2) : '关闭', unit: deviceState.softLimit > 0 ? '米' : '' },
  { label: '送料电机转速', value: Number.isInteger(deviceState.feedSpeed / 10) ? deviceState.feedSpeed / 10 : (deviceState.feedSpeed / 10).toFixed(1), unit: '圈/秒' },
  { label: '送料电机扭矩', value: deviceState.motorTorque, unit: '%' },
  { label: '移动速度', value: deviceState.moveSpeed, unit: '%' },
  { label: '充电目标电压', value: deviceState.chargingTargetVoltage / 100, unit: 'V' },
  { label: '充电电流预警', value: deviceState.chargingCurrentLimit / 1000, unit: 'A' },
  { label: '启动最低电压', value: deviceState.startMinimumVoltage / 100, unit: 'V' },
  { label: '自动关机时间', value: deviceState.autoShutdownTime, unit: '分钟' },
  { label: '自动除雾时间', value: formatDefogTime(deviceState.defogTime) },
  { label: '平移等待时间', value: deviceState.translationWaitTime ?? 0, unit: '秒' },
]);
const formatRealtimeValue = (value, unit) => `${Number.isFinite(Number(value)) ? Number(value) : 0}${unit}`;


const applyStateToForm = () => {
  defogTimeInput.value = deviceState.defogTime > 0 ? formatDefogTime(deviceState.defogTime) : '05:00';
  Object.assign(parameterForm, {
    nearWaitTime: deviceState.nearWaitTime,
    farWaitTime: deviceState.farWaitTime,
    manualTripsVal: deviceState.manualTripsVal,
    softLimit: deviceState.softLimit / 100,
    feedSpeed: deviceState.feedSpeed / 10,
    motorTorque: deviceState.motorTorque,
    moveSpeed: deviceState.moveSpeed,
    chargingTargetVoltage: deviceState.chargingTargetVoltage / 100,
    chargingCurrentLimit: deviceState.chargingCurrentLimit / 1000,
    startMinimumVoltage: deviceState.startMinimumVoltage / 100,
    autoShutdownTime: deviceState.autoShutdownTime,
    translationWaitTime: deviceState.translationWaitTime ?? '',
    runMode: deviceState.runMode === '手动' ? '1' : '0',
  });
};

const loadDevice = async () => {
  loading.value = true;
  try {
    const deviceCode = String(route.params.deviceCode || '');
    const passedDevice = getSelectedDevice();
    device.value = passedDevice?.deviceCode === deviceCode ? { ...passedDevice } : null;

    if (!device.value) throw new Error('未找到该设备');
    editableName.value = device.value.remarkName || '';
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    loading.value = false;
  }
};

const sendCommand = async (data, timeout = 10000) => {
  if (!device.value?.deviceCode) throw new Error('设备编码不存在');
  if (!isBound.value) throw new Error('设备未绑定，无法下发指令');
  if (!deviceStatus.value.isOnline) throw new Error('设备离线，无法下发指令');
  return api.post('/api/devices/command', {
    deviceCode: device.value.deviceCode,
    type: 'send',
    params: { data },
    timeout,
  });
};

const refreshState = async () => {
  if (refreshing.value || !canOperate.value) return;
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
  if (commandBusy.value || !canOperate.value) return;
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

const handleDeviceControl = async () => {
  if (!canDeviceControl.value) return;
  const action = deviceState.controlState === 'running' ? 'pause' : 'start';
  commandBusy.value = true;
  try {
    await sendCommand(action === 'pause' ? '$h=0' : '$h=1');
    deviceState.controlState = action === 'pause' ? 'paused' : 'running';
    deviceState.controlStateLabel = action === 'pause' ? '暂停' : '运行中';
    deviceState.deviceStatus = action === 'pause' ? '暂停' : '运行中';
    showToast(action === 'pause' ? '已下发暂停指令' : '已下发开始指令');
    await refreshState();
  } catch (error) {
    showToast(error.message || '设备操作失败', 'error');
  } finally {
    commandBusy.value = false;
  }
};

const saveParameter = async (field, confirmedOutOfRange = false) => {
  if (field.key === 'translationWaitTime' && (
    String(parameterForm[field.key]).trim() === '' ||
    !Number.isSafeInteger(Number(parameterForm[field.key])) ||
    Number(parameterForm[field.key]) < 0
  )) {
    return showToast('平移等待时间需为非负整数秒', 'error');
  }
  if (field.key === 'moveSpeed' && String(parameterForm[field.key] ?? '').trim() === '') {
    return showToast('请输入正确的移动速度', 'error');
  }
  const numericValue = Number(parameterForm[field.key]);
  if (!Number.isFinite(numericValue)) return showToast(`请输入正确的${field.label}`, 'error');
  if (field.key === 'moveSpeed' && (numericValue < 50 || numericValue > 100) && !confirmedOutOfRange) {
    pendingMoveSpeed.value = numericValue;
    moveSpeedConfirmVisible.value = true;
    return;
  }
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

const confirmMoveSpeed = () => {
  moveSpeedConfirmVisible.value = false;
  parameterForm.moveSpeed = pendingMoveSpeed.value;
  const field = parameterFields.find((item) => item.key === 'moveSpeed');
  if (field) saveParameter(field, true);
};

const saveDefogTime = async (close = false) => {
  if (commandBusy.value || !canOperate.value) return;
  const value = close ? 0 : encodeDefogTime(defogTimeInput.value);
  if (value === null) return showToast('请选择有效时间，不能设置 00:00', 'error');
  commandBusy.value = true;
  try {
    await sendCommand(`$j=${value}`);
    deviceState.defogTime = value;
    showToast(close ? '自动除雾已关闭' : '自动除雾时间已同步');
  } catch (error) {
    showToast(error.message || '自动除雾时间同步失败', 'error');
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
  if (name === (device.value.remarkName || '')) return showToast('备注名称没有变化');
  savingName.value = true;
  try {
    const updated = await api.put(`/api/admin/devices/${device.value.id}`, {
      remarkName: name,
      deviceType: device.value.deviceType,
    });
    device.value = { ...device.value, ...updated };
    showToast('备注名称已保存，APP 端将同步显示');
  } catch (error) {
    showToast(error.message || '设备名称保存失败', 'error');
  } finally {
    savingName.value = false;
  }
};

const saveAllSlots = async () => {
  if (savingSlots.value || !canOperate.value) return;
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
.device-detail-page { display: grid; gap: 12px; }
.detail-loading { min-height: 420px; }
.detail-error { padding: 60px; text-align: center; }
.detail-error p { margin: 0 0 22px; color: var(--muted); }
.detail-hero { overflow: hidden; padding: 12px 20px; border-radius: 14px; color: #fff; background: linear-gradient(135deg, #172c72 0%, #3157e5 70%, #426af0 100%); box-shadow: 0 16px 36px rgba(32, 62, 158, .2); }
.detail-back { display: inline-flex; align-items: center; gap: 8px; padding: 5px 0; border: 0; color: #dce4ff; background: transparent; font-size: 12px; }
.detail-back:hover { color: #fff; }
.detail-back span { font-size: 18px; }
.detail-hero-main { display: flex; align-items: center; gap: 14px; margin-top: 6px; }
.detail-device-icon { position: relative; width: 42px; height: 42px; display: grid; flex: 0 0 42px; place-items: center; border: 1px solid rgba(255,255,255,.22); border-radius: 16px; color: #fff; background: rgba(255,255,255,.12); }
.detail-device-icon i { position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border: 2px solid #fff; border-radius: 50%; background: #b8c0cf; box-shadow: 0 1px 3px rgba(16,25,54,.28); }
.detail-device-icon i.online { background: var(--success); }
.readonly-device-name { display: block; margin-top: 6px; color: var(--muted); font-size: 11px; }
.detail-device-info { min-width: 0; flex: 1; }
.detail-title-row { display: flex; align-items: center; gap: 9px; }
.detail-title-row h2 { max-width: 460px; margin: 0; overflow: hidden; text-overflow: ellipsis; font-size: 21px; white-space: nowrap; }
.detail-title-row .tag { border: 1px solid rgba(255,255,255,.14); }
.detail-device-info p { margin: 8px 0 0; color: #cbd6ff; font-size: 12px; }
.detail-hero-actions { display: flex; gap: 10px; }
.detail-hero-actions .secondary-btn { border-color: rgba(255,255,255,.22); color: #fff; background: rgba(255,255,255,.1); }
.detail-hero-actions .primary-btn { color: #284cc8; background: #fff; box-shadow: none; }
.detail-hero-actions button:disabled { cursor: not-allowed; opacity: .5; }
.detail-warning { margin-top: 18px; padding: 11px 14px; border: 1px solid rgba(255,218,158,.25); border-radius: 10px; color: #ffe1ae; background: rgba(255,180,61,.1); font-size: 12px; }
.detail-tabs { display: flex; gap: 6px; padding: 6px; border: 1px solid var(--line); border-radius: 13px; background: #fff; box-shadow: var(--shadow); }
.detail-tabs button { min-width: 110px; height: 34px; padding: 0 20px; border: 0; border-radius: 9px; color: #6c7689; background: transparent; font-size: 13px; font-weight: 650; }
.detail-tabs button:hover { color: var(--primary); background: #f6f8ff; }
.detail-tabs button.active { color: #fff; background: var(--primary); box-shadow: 0 7px 16px rgba(49,87,229,.18); }
.status-layout { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr); gap: 12px; }
.status-overview { min-height: 206px; display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 14px; align-items: center; padding: 16px; }
.status-ring { width: 164px; height: 164px; display: grid; place-items: center; border-radius: 50%; transform: rotate(-90deg); }
.status-ring-core { width: 134px; height: 134px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 1px #edf0f7; transform: rotate(90deg); }
.status-ring-core time { margin-bottom: 10px; padding: 4px 10px; border-radius: 999px; color: var(--primary); background: #f1f4ff; font-size: 12px; font-style: normal; font-weight: 650; line-height: 1; }
.status-ring-core span { color: var(--muted); font-size: 12px; }
.status-ring-core strong { margin-top: 6px; font-size: 18px; }
.status-ring-core b { margin-top: 11px; color: var(--primary); font-size: 17px; }
.status-ring-core em { color: var(--muted); font-size: 12px; font-style: normal; font-weight: 500; }
.status-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.status-summary div { min-height: 72px; padding: 12px; border: 1px solid #e8ebf2; border-radius: 13px; background: #fafbfe; }
.status-summary span, .status-summary strong { display: block; }
.status-summary span { color: var(--muted); font-size: 11px; }
.status-summary strong { margin-top: 10px; font-size: 16px; }
.panel-header.compact { min-height: 48px; padding: 10px 16px; }
.response-copy-btn { height: 34px; padding: 0 14px; border-radius: 8px; font-size: 12px; }
.response-copy-btn:disabled { cursor: not-allowed; opacity: .5; }
.raw-response-panel { min-width: 0; }
.raw-response-panel pre { height: 158px; margin: 0; overflow: auto; padding: 12px 16px; color: #dce4ff; background: #111a31; font: 12px/1.75 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; word-break: break-all; }
.metric-panel { overflow: hidden; }
.metric-grid { display: grid; }
.run-metric-grid {
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: 80px;
  row-gap: 1px;
  background: var(--line);
}
.run-metric-grid::after { content: ''; background: #fff; }
.run-metric-grid .metric-item { background: #fff; }
.metric-item { min-width: 0; padding: 14px 16px; border-right: 1px solid var(--line); }
.run-metric-grid .metric-item:nth-child(7n) { border-right: 0; }
.metric-item span, .metric-item strong { display: block; }
.metric-item span { color: var(--muted); font-size: 12px; }
.metric-item strong { margin-top: 8px; font-size: 21px; }
.metric-item em { margin-left: 5px; color: var(--muted); font-size: 12px; font-style: normal; font-weight: 500; }
.device-state-panel { display: flex; align-items: stretch; }
.device-state-panel .panel-header { border-bottom: 0; border-right: 1px solid var(--line); }
.device-status-grid { flex: 1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.device-status-grid .metric-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 20px; }
.device-status-grid .metric-item strong { margin-top: 0; font-size: 18px; }
.device-status-grid .metric-item:last-child { border-right: 0; }
.settings-layout { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 12px; align-items: start; }
.settings-panel { display: flex; overflow: hidden; flex-direction: column; }
.parameter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; align-items: start; padding: 16px; }
.parameter-field { min-width: 0; }
.parameter-field label { display: block; margin-bottom: 6px; color: #556075; font-size: 12px; font-weight: 650; }
.parameter-control { min-height: 43px; display: flex; align-items: center; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
.parameter-control:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.parameter-control input { min-width: 0; height: 41px; flex: 1; padding: 0 12px; border: 0; outline: none; color: var(--ink); background: transparent; }
.run-mode-select { flex: 1; }
.run-mode-select :deep(.filter-select) { height: 41px; border: 0; border-radius: 0; }
.parameter-control span { padding: 0 10px; color: var(--muted); font-size: 11px; white-space: nowrap; }
.parameter-control button { height: 31px; margin-right: 5px; padding: 0 11px; border: 0; border-radius: 7px; color: var(--primary); background: var(--primary-soft); font-size: 11px; font-weight: 700; }
.parameter-control button:disabled { cursor: not-allowed; opacity: .5; }
.settings-side { display: grid; gap: 12px; }
.side-card { overflow: hidden; }
.side-card-body { padding: 12px 16px; }
.full-button { width: 100%; margin-top: 8px; }
.custom-command { height: 48px !important; }
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
@media (max-width: 1600px) {
  .parameter-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1400px) {
  .status-overview { grid-template-columns: 156px minmax(0, 1fr); gap: 8px; padding: 12px; }
  .status-ring { width: 148px; height: 148px; }
  .status-ring-core { width: 122px; height: 122px; }
  .status-ring-core strong { font-size: 16px; }
  .schedule-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 1200px) {
  .run-metric-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .run-metric-grid::after { grid-column: span 2; }
  .run-metric-grid .metric-item:nth-child(n) { border-right: 1px solid var(--line); }
  .run-metric-grid .metric-item:nth-child(5n) { border-right: 0; }
}
@media (min-width: 1101px) and (max-height: 800px) {
  .detail-hero { padding: 8px 16px; }
  .detail-back { padding: 0; }
  .detail-hero-main { margin-top: 2px; }
  .status-overview { min-height: 172px; padding: 10px; grid-template-columns: 142px minmax(0, 1fr); }
  .status-ring { width: 140px; height: 140px; }
  .status-ring-core { width: 116px; height: 116px; }
  .status-summary div { min-height: 60px; padding: 8px; }
  .raw-response-panel pre { height: 118px; }
  .panel-header.compact { min-height: 42px; padding: 8px 14px; }
  .run-metric-grid {
    grid-auto-rows: 72px;
  }
  .metric-item { padding: 10px 14px; }
  .parameter-grid { gap: 10px; padding: 12px; }
  .settings-side .panel-header p { display: none; }
  .side-card-body { padding: 8px 12px; }
}
@media (min-width: 1101px) {
  .device-detail-page { height: 100%; min-height: 0; grid-template-rows: auto auto minmax(0, 1fr); }
  .detail-tab-status { grid-template-rows: auto auto minmax(0, 1.05fr) minmax(0, 1fr) 58px; }
  .status-layout, .status-overview { min-height: 0; }
  .status-summary { height: 100%; }
  .status-summary > div { display: flex; flex-direction: column; justify-content: center; }
  .raw-response-panel { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .raw-response-panel .panel-header, .metric-panel .panel-header, .settings-panel .panel-header, .side-card .panel-header { flex-shrink: 0; }
  .raw-response-panel pre { flex: 1; min-height: 0; height: auto; }
  .metric-panel:not(.device-state-panel) { display: flex; flex-direction: column; min-height: 0; }
  .run-metric-grid { flex: 1; min-height: 0; grid-template-rows: repeat(2, minmax(0, 1fr)); grid-auto-rows: auto; }
  .run-metric-grid .metric-item { display: flex; flex-direction: column; justify-content: center; }
  .settings-layout { min-height: 0; align-items: stretch; }
  .settings-panel { min-height: 0; }
  .parameter-grid { flex: 1; min-height: 0; grid-template-rows: repeat(4, minmax(0, 1fr)); align-items: center; }
  .settings-side { min-height: 0; grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) auto; }
  .side-card { display: flex; flex-direction: column; min-height: 0; }
  .side-card-body { display: flex; flex-direction: column; flex: 1; min-height: 0; justify-content: center; }
  .side-card-body > input, .side-card-body > button { flex-shrink: 0; }
  .custom-command { flex: 1; min-height: 48px; height: auto !important; resize: none; }
  .schedule-panel { min-height: 0; overflow: auto; }
}
@media (min-width: 1101px) and (max-width: 1600px) {
  .parameter-grid { grid-template-rows: repeat(5, minmax(0, 1fr)); }
}
@media (min-width: 1101px) and (max-width: 1200px) {
  .run-metric-grid { grid-template-rows: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1100px) {
  .status-layout, .settings-layout { grid-template-columns: 1fr; }
  .detail-hero-main { flex-wrap: wrap; }
  .detail-hero-actions { flex-wrap: wrap; }
}
@media (max-width: 900px) {
  .parameter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .run-metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .run-metric-grid .metric-item:nth-child(n) { border-right: 1px solid var(--line); }
  .run-metric-grid .metric-item:nth-child(3n) { border-right: 0; }
}

/* 参数设置页恢复原来的双列布局与自然滚动。 */
.detail-tab-parameters { height: auto; grid-template-rows: none; gap: 18px; }
.detail-tab-parameters .detail-hero { overflow: hidden; padding: 20px 24px 24px; border-radius: 18px; color: #fff; background: linear-gradient(135deg, #172c72 0%, #3157e5 70%, #426af0 100%); box-shadow: 0 16px 36px rgba(32, 62, 158, .2); }
.detail-tab-parameters .detail-back { display: inline-flex; align-items: center; gap: 8px; padding: 5px 0; border: 0; color: #dce4ff; background: transparent; font-size: 12px; }
.detail-tab-parameters .detail-back:hover { color: #fff; }
.detail-tab-parameters .detail-back span { font-size: 18px; }
.detail-tab-parameters .detail-hero-main { display: flex; align-items: center; gap: 17px; margin-top: 16px; }
.detail-tab-parameters .detail-device-icon { position: relative; width: 58px; height: 58px; display: grid; flex: 0 0 58px; place-items: center; border: 1px solid rgba(255,255,255,.22); border-radius: 16px; color: #fff; background: rgba(255,255,255,.12); }
.detail-tab-parameters .detail-device-icon i { position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border: 2px solid #fff; border-radius: 50%; background: #b8c0cf; box-shadow: 0 1px 3px rgba(16,25,54,.28); }
.detail-tab-parameters .detail-device-icon i.online { background: var(--success); }
.detail-tab-parameters .readonly-device-name { color: var(--muted); font-size: 12px; }
.detail-tab-parameters .detail-title-row h2 { max-width: 460px; margin: 0; overflow: hidden; text-overflow: ellipsis; font-size: 24px; white-space: nowrap; }
.detail-tab-parameters .detail-tabs { display: flex; gap: 6px; padding: 6px; border: 1px solid var(--line); border-radius: 13px; background: #fff; box-shadow: var(--shadow); }
.detail-tab-parameters .detail-tabs button { min-width: 128px; height: 40px; padding: 0 20px; border: 0; border-radius: 9px; color: #6c7689; background: transparent; font-size: 13px; font-weight: 650; }
.detail-tab-parameters .detail-tabs button:hover { color: var(--primary); background: #f6f8ff; }
.detail-tab-parameters .detail-tabs button.active { color: #fff; background: var(--primary); box-shadow: 0 7px 16px rgba(49,87,229,.18); }
.detail-tab-parameters .panel-header.compact { min-height: 64px; padding: 15px 20px; }
.detail-tab-parameters .settings-layout { display: grid; grid-template-columns: minmax(620px, 1.25fr) minmax(340px, .75fr); gap: 18px; align-items: stretch; }
.detail-tab-parameters .settings-panel { display: flex; overflow: hidden; flex-direction: column; }
.detail-tab-parameters .parameter-grid { display: grid; flex: 1; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, minmax(72px, 1fr)); gap: 14px 18px; align-items: center; padding: 18px 22px; }
.detail-tab-parameters .parameter-field { min-width: 0; }
.detail-tab-parameters .parameter-field label { display: block; margin-bottom: 8px; color: #556075; font-size: 12px; font-weight: 650; }
.detail-tab-parameters .parameter-control { min-height: 43px; display: flex; align-items: center; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
.detail-tab-parameters .parameter-control:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.detail-tab-parameters .parameter-control input { min-width: 0; height: 41px; flex: 1; padding: 0 12px; border: 0; outline: none; color: var(--ink); background: transparent; }
.detail-tab-parameters .parameter-control span { padding: 0 10px; color: var(--muted); font-size: 11px; white-space: nowrap; }
.detail-tab-parameters .parameter-control button { height: 31px; margin-right: 5px; padding: 0 11px; border: 0; border-radius: 7px; color: var(--primary); background: var(--primary-soft); font-size: 11px; font-weight: 700; }
.detail-tab-parameters .parameter-control button:disabled { cursor: not-allowed; opacity: .5; }
.detail-tab-parameters .settings-side { display: grid; gap: 14px; }
.detail-tab-parameters .side-card { overflow: hidden; }
.detail-tab-parameters .side-card-body { padding: 16px 20px 18px; }
.detail-tab-parameters .full-button { width: 100%; margin-top: 12px; }
.detail-tab-parameters .custom-command { height: 72px !important; }
.detail-tab-parameters .custom-response { max-height: 140px; margin: 12px 0 0; overflow: auto; padding: 12px; border-radius: 9px; color: #dce4ff; background: #111a31; font: 11px/1.65 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; word-break: break-all; }
.detail-tab-parameters .danger-zone { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 20px; border-color: #ffdede; }
.detail-tab-parameters .danger-zone strong { font-size: 13px; }
.detail-tab-parameters .danger-zone p { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
.detail-tab-parameters .danger-zone .danger-btn { flex: none; }
.detail-tab-parameters .settings-side { grid-template-rows: none; }
.detail-tab-parameters .readonly-device-name { display: inline; margin-top: 0; }
.detail-tab-parameters .side-card, .detail-tab-parameters .side-card-body { display: block; }
.detail-tab-parameters .settings-side .panel-header p { display: block; }
@media (max-width: 1400px) {
  .detail-tab-parameters .settings-layout { grid-template-columns: 1fr; }
  .detail-tab-parameters .parameter-grid { grid-template-rows: none; }
}
</style>
