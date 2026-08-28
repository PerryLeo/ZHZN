<template>
  <view class="page-wrapper">
    <!-- 顶部区域 -->
    <view class="mask-content">
      <view class="header">
        <view class="header-main">
          <text class="page-title">设备控制中心</text>
          <view class="header-actions">
            <view class="refresh-btn" @click="goMine">我的</view>
            <view class="refresh-btn" @click="handleManualRefresh">刷新</view>
          </view>
        </view>
        <text class="page-subtitle">我的设备共 {{ formatSummaryValue(deviceSummary.total) }} 台</text>
      </view>
      <view class="summary-board">
        <view class="summary-item">
          <text class="num">{{ formatSummaryValue(deviceSummary.total) }}</text>
          <text class="label">已绑定</text>
        </view>
        <view class="summary-item border-line">
          <text class="num highlight">{{ formatSummaryValue(deviceSummary.online) }}</text>
          <text class="label">在线</text>
        </view>
        <view class="summary-item">
          <text class="num warning">{{ formatSummaryValue(deviceSummary.offline) }}</text>
          <text class="label">离线</text>
        </view>
      </view>
    </view>

    <view class="main-scroll">
      <view class="scroll-inner">
        <!-- ====== 已绑定设备 ====== -->
        <view class="section device-section">
          <view class="section-header">
            <view class="section-title-wrap">
              <text class="section-title">我的设备</text>
              <view class="device-checking-hint" v-if="isBoundStatusChecking">
                <view class="device-checking-spinner"></view>
                <text>正在检测设备状态</text>
              </view>
            </view>
            <view class="section-actions">
              <view class="group-select" :class="{ open: groupDropdownVisible }" @click.stop="toggleGroupDropdown">
                <text class="group-select-text">{{ selectedGroupName }}</text>
                <view class="group-select-arrow"></view>
                <view class="group-dropdown" v-if="groupDropdownVisible" @click.stop>
                  <view
                    class="group-option"
                    :class="{ selected: selectedGroupId === 'all' }"
                    @click="selectDeviceGroup('all')"
                  >
                    <text class="group-option-name">全部设备</text>
                    <text class="group-option-count">{{ allBoundTotal }}</text>
                  </view>
                  <view
                    class="group-option"
                    :class="{ selected: selectedGroupId === group.id }"
                    v-for="group in deviceGroups"
                    :key="group.id"
                    @click="selectDeviceGroup(group.id)"
                  >
                    <text class="group-option-name">{{ group.name }}</text>
                    <text class="group-option-count">{{ group.deviceCount }}</text>
                  </view>
                  <view class="group-option-empty" v-if="!groupLoading && deviceGroups.length === 0">
                    暂无分组
                  </view>
                </view>
              </view>
              <view class="section-add-btn" @click.stop="openGroupModal">
                <view class="section-add-icon"></view>
              </view>
            </view>
          </view>
          <view class="group-dropdown-mask" v-if="groupDropdownVisible" @click="groupDropdownVisible = false"></view>
          <text class="loading-text" v-if="boundLoading">加载中...</text>
          <view class="batch-row" v-if="!boundLoading && filteredBoundDevices.length > 0">
            <view class="batch-btn" :class="{ disabled: batchCommandLoading || isBoundStatusChecking }" @click="turnAllOn">
              <text class="batch-btn-text">{{ batchCommandLoading ? '执行中...' : '全部开始' }}</text>
            </view>
            <view class="batch-btn batch-btn-off" :class="{ disabled: batchCommandLoading || isBoundStatusChecking }" @click="turnAllOff">
              <text class="batch-btn-text">{{ batchCommandLoading ? '执行中...' : '全部暂停' }}</text>
            </view>
          </view>
          <view class="bound-grid" v-if="!boundLoading && filteredBoundDevices.length > 0">
            <view
              class="bound-card"
              :class="{ 'is-disabled': item.statusLoading || item.online !== 1 }"
              v-for="item in filteredBoundDevices"
              :key="item.id"
              @click="toBoundDevice(item)"
            >
              <view class="bound-head">
                <view class="bound-icon" :class="{ online: item.online === 1, checking: item.statusLoading }">
                  <text class="iconfont icon-online bound-device-icon"></text>
                  <view class="connection-dot" :class="{ online: item.online === 1, checking: item.statusLoading }"></view>
                </view>
                <view class="device-control">
                  <view class="device-state-info">
                    <text class="device-state-caption">状态</text>
                    <text class="device-state-value" :class="item.runState">{{ item.runStateLabel }}</text>
                  </view>
                  <view
                    class="device-action-button"
                    :class="{
                      disabled: item.online !== 1 || item.statusLoading || item.switchLoading || item.runState === 'unknown' || item.runState === 'returning'
                    }"
                    @click.stop="handleDeviceAction(item)"
                  >
                    <text>{{ getDeviceActionLabel(item) }}</text>
                  </view>
                </view>
              </view>
              <view class="bound-info">
                <text class="bound-name">{{ item.remarkName || '--' }}</text>
              </view>
              <view class="bound-metrics">
                <view class="bound-metric">
                  <text class="metric-label">信号</text>
                  <view class="signal-icon bound-signal-icon">
                    <view class="signal-bar" :style="{ backgroundColor: item.csqSignalLevel >= 1 ? getSignalColor(item.csqSignalLevel) : '#E0E0E0' }"></view>
                    <view class="signal-bar" :style="{ backgroundColor: item.csqSignalLevel >= 2 ? getSignalColor(item.csqSignalLevel) : '#E0E0E0' }"></view>
                    <view class="signal-bar" :style="{ backgroundColor: item.csqSignalLevel >= 3 ? getSignalColor(item.csqSignalLevel) : '#E0E0E0' }"></view>
                  </view>
                </view>
                <view class="metric-divider"></view>
                <view class="bound-metric">
                  <text class="metric-label">电量</text>
                  <text class="metric-value">{{ formatBatteryLevel(item.battery) }}</text>
                </view>
                <view class="metric-divider"></view>
                <view class="bound-metric">
                  <text class="metric-label">电流</text>
                  <text :class="['metric-value', getMetricValueClass(item.current, 'current')]">{{ formatMetric(item.current, 'A') }}</text>
                </view>
              </view>
              <view class="mode-row">
                <text class="mode-label">身份状态</text>
                <text
                  class="mode-value"
                  :class="{
                    abnormal: item.online === 1 && item.identityMismatch,
                    normal: !item.statusLoading && item.online === 1 && !item.identityMismatch
                  }"
                >
                  {{ item.statusLoading ? '--' : (item.online !== 1 ? '--' : (item.identityMismatch ? '身份异常' : '身份正常')) }}
                </text>
              </view>
              <view class="mode-row">
                <text class="mode-label">异常状态</text>
                <text class="mode-value" :class="{ abnormal: item.hasAlarm }">{{ item.abnormalStatus }}</text>
              </view>
            </view>
          </view>
          <view class="bound-pagination" v-if="!boundLoading && boundTotal > 0">
            <view
              class="pagination-btn"
              :class="{ disabled: boundPage <= 1 }"
              @click.stop="changeBoundPage(boundPage - 1)"
            >上一页</view>
            <text class="pagination-info">第 {{ boundPage }} / {{ boundTotalPages }} 页</text>
            <view
              class="pagination-btn"
              :class="{ disabled: boundPage >= boundTotalPages }"
              @click.stop="changeBoundPage(boundPage + 1)"
            >下一页</view>
          </view>
          <view class="bound-empty" v-if="!boundLoading && filteredBoundDevices.length === 0">
            <text>{{ selectedGroupId === 'all' ? '暂无已绑定设备' : '该分组暂无设备' }}</text>
          </view>
        </view>

        <!-- ====== 附近蓝牙设备 ====== -->
        <view class="section">
          <view class="section-header">
            <text class="section-title">附近蓝牙设备</text>
            <text class="section-count" v-if="devices.length > 0">共 {{ devices.length }} 台</text>
          </view>

          <uni-swipe-action>
            <uni-swipe-action-item
              v-for="item in devices"
              :key="item.mac"
              :right-options="swipeOptions"
              :show="item.show"
              @change="item.show = $event"
              @click="onSwipeClick($event, item)"
            >
              <view class="device-card-container">
                <view class="device-card" @click="toDeviceDetail(item)">
                  <view class="device-icon-box">
                    <text class="iconfont icon-lanya device-bt-icon"></text>
                  </view>
                  <view class="device-info">
                    <view class="info-top">
                    <text class="d-name">{{ item.remarkName || '未知设备' }}</text>
                      <text class="abnormal-tag" v-if="item.isAbnormal">异常</text>
                    </view>
                    <view class="info-bottom">
                      <text class="d-id">MAC: {{ item.mac }}</text>
                    </view>
                  </view>
                  <view class="device-action" v-if="item.canConnect">
                    <view class="signal-box">
                      <view class="signal-icon">
                        <view class="signal-bar" :class="{ 'active': item.signalLevel >= 1 }"
                          :style="{ backgroundColor: item.signalLevel >= 1 ? item.signalColor : '#E0E0E0' }"></view>
                        <view class="signal-bar" :class="{ 'active': item.signalLevel >= 2 }"
                          :style="{ backgroundColor: item.signalLevel >= 2 ? item.signalColor : '#E0E0E0' }"></view>
                        <view class="signal-bar" :class="{ 'active': item.signalLevel >= 3 }"
                          :style="{ backgroundColor: item.signalLevel >= 3 ? item.signalColor : '#E0E0E0' }"></view>
                        <view class="signal-bar" :class="{ 'active': item.signalLevel >= 4 }"
                          :style="{ backgroundColor: item.signalLevel >= 4 ? item.signalColor : '#E0E0E0' }"></view>
                      </view>
                    </view>
                    <text class="d-status">可连接</text>
                  </view>
                </view>
              </view>
            </uni-swipe-action-item>
          </uni-swipe-action>
        </view>

        <view class="empty-tip" v-if="devices.length === 0">
          <text>暂无设备，点击下方按钮添加</text>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="footer-action">
      <button class="add-btn" @click="addDevice">
        <text class="plus">+</text>
        <text>添加新设备</text>
      </button>
      <text class="company-text">APP版本: {{ appVersion }}</text>
    </view>

    <!-- 编辑名称弹窗 -->
    <view class="custom-modal-mask" :class="{ 'show': editModalVisible }" @click="closeEditModal">
      <view class="custom-modal" @click.stop :class="{ 'slide-up': editModalVisible }">
        <view class="modal-header">
        <text class="modal-title">修改备注名称</text>
        </view>
        <view class="modal-body">
          <view class="input-wrap">
            <input class="modern-input" v-model="editDeviceName" :focus="editModalVisible"
              placeholder="请输入备注名称" placeholder-style="color: #ccc;" />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-cancel" @click="closeEditModal">取消</button>
          <button class="btn btn-confirm" @click="confirmEdit">确定</button>
        </view>
      </view>
    </view>

    <!-- 新建设备分组弹窗 -->
    <view class="group-modal-mask" v-if="groupModalVisible" @click="closeGroupModal">
      <view class="group-modal" @click.stop>
        <view class="group-modal-header">
          <view>
            <text class="group-modal-title">新建设备分组</text>
            <text class="group-modal-subtitle">设置名称并选择需要加入的设备</text>
          </view>
          <view class="group-modal-close" @click="closeGroupModal">×</view>
        </view>
        <view class="group-modal-body">
          <text class="group-field-label">分组名称</text>
          <view class="group-name-input-wrap">
            <input
              class="group-name-input"
              v-model="groupName"
              maxlength="50"
              placeholder="请输入分组名称"
              placeholder-style="color: #B5BAC4;"
            />
          </view>
          <view class="group-device-title-row">
            <text class="group-field-label">选择设备</text>
            <text class="group-selected-count">已选 {{ selectedGroupDeviceIds.length }} 台</text>
          </view>
          <scroll-view scroll-y class="group-device-list">
            <text class="group-device-loading" v-if="groupCandidateLoading">加载中...</text>
            <view
              class="group-device-item"
              :class="{ selected: isGroupDeviceSelected(device.id) }"
              v-for="device in groupCandidateDevices"
              :key="device.id"
              @click="toggleGroupDevice(device.id)"
            >
              <view class="group-device-icon" :class="{ online: device.online === 1 }">
                <text class="iconfont icon-online"></text>
              </view>
              <view class="group-device-info">
                <text class="group-device-name">{{ device.remarkName || device.deviceName || device.deviceCode }}</text>
                <text class="group-device-code">{{ device.deviceCode }}</text>
              </view>
              <view class="group-device-check" :class="{ checked: isGroupDeviceSelected(device.id) }">
                <view class="group-device-checkmark"></view>
              </view>
            </view>
            <view class="group-device-empty" v-if="!groupCandidateLoading && groupCandidateDevices.length === 0">暂无可选设备</view>
          </scroll-view>
          <view class="group-device-pagination" v-if="groupCandidateTotalPages > 1">
            <view
              class="group-page-btn"
              :class="{ disabled: groupCandidatePage <= 1 }"
              @click="changeGroupCandidatePage(groupCandidatePage - 1)"
            >上一页</view>
            <text class="group-page-info">{{ groupCandidatePage }} / {{ groupCandidateTotalPages }}</text>
            <view
              class="group-page-btn"
              :class="{ disabled: groupCandidatePage >= groupCandidateTotalPages }"
              @click="changeGroupCandidatePage(groupCandidatePage + 1)"
            >下一页</view>
          </view>
        </view>
        <view class="group-modal-footer">
          <button class="group-cancel-btn" @click="closeGroupModal">取消</button>
          <button class="group-create-btn" :disabled="groupSubmitting" @click="createDeviceGroup">
            {{ groupSubmitting ? '创建中...' : '创建分组' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import http from '@/common/request.js';

// ============ 已绑定设备 ============
const DEVICE_PAGE_SIZE = 10;
const boundDevices = ref([]);
const boundLoading = ref(false);
const batchCommandLoading = ref(false);
const manualRefreshLoading = ref(false);
let boundStatusQueue = Promise.resolve();
const boundPage = ref(1);
const boundTotal = ref(0);
const allBoundTotal = ref(0);
const boundTotalPages = ref(0);
const createEmptyDeviceSummary = () => ({ total: null, online: null, offline: null });
const deviceSummary = ref(createEmptyDeviceSummary());
const deviceGroups = ref([]);
const groupLoading = ref(false);
const selectedGroupId = ref('all');
const groupDropdownVisible = ref(false);
const groupModalVisible = ref(false);
const groupName = ref('');
const selectedGroupDeviceIds = ref([]);
const groupSubmitting = ref(false);
const groupCandidateDevices = ref([]);
const groupCandidateLoading = ref(false);
const groupCandidatePage = ref(1);
const groupCandidateTotalPages = ref(0);

const selectedGroupName = computed(() => {
  if (selectedGroupId.value === 'all') return '全部设备';
  return deviceGroups.value.find(group => group.id === selectedGroupId.value)?.name || '全部设备';
});

const filteredBoundDevices = computed(() => {
  return boundDevices.value;
});

const isBoundStatusChecking = computed(() => boundDevices.value.some(device => device.statusLoading));

const toggleGroupDropdown = () => {
  groupDropdownVisible.value = !groupDropdownVisible.value;
};

const selectDeviceGroup = async (groupId) => {
  selectedGroupId.value = groupId;
  groupDropdownVisible.value = false;
  boundPage.value = 1;
  await fetchBoundDevices();
};

const fetchDeviceGroups = async (throwOnError = false) => {
  groupLoading.value = true;
  try {
    const list = await http.get('/api/device-groups');
    deviceGroups.value = Array.isArray(list) ? list : [];
    if (
      selectedGroupId.value !== 'all' &&
      !deviceGroups.value.some(group => group.id === selectedGroupId.value)
    ) {
      selectedGroupId.value = 'all';
    }
  } catch (error) {
    deviceGroups.value = [];
    if (throwOnError) throw error;
  } finally {
    groupLoading.value = false;
  }
};

const fetchDeviceSummary = async (throwOnError = false) => {
  try {
    const result = await http.get('/api/users/devices/summary');
    deviceSummary.value = {
      total: Number(result?.total) || 0,
      online: Number(result?.online) || 0,
      offline: Number(result?.offline) || 0
    };
  } catch (error) {
    deviceSummary.value = createEmptyDeviceSummary();
    if (throwOnError) throw error;
  }
};

const formatSummaryValue = (value) => Number.isFinite(value) ? String(value) : '--';

const fetchGroupCandidateDevices = async () => {
  groupCandidateLoading.value = true;
  try {
    const result = await http.get('/api/users/devices', {
      page: groupCandidatePage.value,
      pageSize: DEVICE_PAGE_SIZE
    });
    groupCandidateDevices.value = Array.isArray(result?.list) ? result.list : [];
    groupCandidateTotalPages.value = Number(result?.totalPages) || 0;
  } catch (error) {
    groupCandidateDevices.value = [];
    groupCandidateTotalPages.value = 0;
  } finally {
    groupCandidateLoading.value = false;
  }
};

const changeGroupCandidatePage = async (page) => {
  if (groupCandidateLoading.value || page < 1 || page > groupCandidateTotalPages.value) return;
  groupCandidatePage.value = page;
  await fetchGroupCandidateDevices();
};

const openGroupModal = async () => {
  groupDropdownVisible.value = false;
  if (boundLoading.value) {
    uni.showToast({ title: '设备加载中，请稍后', icon: 'none' });
    return;
  }
  if (allBoundTotal.value === 0) {
    uni.showToast({ title: '暂无可分组设备', icon: 'none' });
    return;
  }
  groupName.value = '';
  selectedGroupDeviceIds.value = [];
  groupCandidatePage.value = 1;
  groupModalVisible.value = true;
  await fetchGroupCandidateDevices();
};

const closeGroupModal = () => {
  if (groupSubmitting.value) return;
  groupModalVisible.value = false;
  groupName.value = '';
  selectedGroupDeviceIds.value = [];
};

const isGroupDeviceSelected = (deviceId) => {
  return selectedGroupDeviceIds.value.includes(Number(deviceId));
};

const toggleGroupDevice = (deviceId) => {
  const id = Number(deviceId);
  const index = selectedGroupDeviceIds.value.indexOf(id);
  if (index === -1) selectedGroupDeviceIds.value.push(id);
  else selectedGroupDeviceIds.value.splice(index, 1);
};

const createDeviceGroup = async () => {
  const name = groupName.value.trim();
  if (!name) {
    uni.showToast({ title: '请输入分组名称', icon: 'none' });
    return;
  }
  if (selectedGroupDeviceIds.value.length === 0) {
    uni.showToast({ title: '请至少选择一台设备', icon: 'none' });
    return;
  }
  if (groupSubmitting.value) return;

  groupSubmitting.value = true;
  uni.showLoading({ title: '正在创建...', mask: true });
  try {
    const created = await http.post('/api/device-groups', {
      name,
      deviceIds: selectedGroupDeviceIds.value
    });
    await fetchDeviceGroups();
    selectedGroupId.value = created?.id || 'all';
    boundPage.value = 1;
    await fetchBoundDevices();
    groupModalVisible.value = false;
    groupName.value = '';
    selectedGroupDeviceIds.value = [];
    uni.showToast({ title: '分组创建成功', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: typeof error === 'string' ? error : '分组创建失败',
      icon: 'none'
    });
  } finally {
    groupSubmitting.value = false;
    uni.hideLoading();
  }
};

const DEVICE_ACTION_COMMANDS = {
  start: '$h=1',
  pause: '$h=0'
};

const findMetricValue = (rawData, names) => {
  const raw = String(rawData || '');
  const match = raw.match(new RegExp(`(?:^|[|\\r\\n])(?:${names.join('|')})\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'));
  return match ? Number(match[1]) : null;
};

const getCsqSignalLevel = (value) => {
  const csq = Number(value);
  if (!Number.isFinite(csq) || csq < 0 || csq > 31) return 0;
  if (csq >= 24) return 3;
  if (csq >= 17) return 2;
  if (csq >= 13) return 1;
  return 0;
};

const parseRunState = (rawData) => {
  const raw = String(rawData || '');
  const carMatch = raw.match(/(?:^|[|\r\n])\s*Car\s*:\s*([^|\r\n]+)/i);
  const carState = carMatch ? carMatch[1].trim() : '';
  const stateMatch = carState.match(/^(Unreturn|Pause|Wait|Waiting|Running|Return|Returning|Idle|A-B|B-A)(?=$|[\s(:])/i);
  const stateKeyword = stateMatch ? stateMatch[1].toLowerCase() : '';
  if (stateKeyword === 'pause') {
    return { runState: 'paused', runStateLabel: '暂停' };
  }
  if (stateKeyword === 'wait' || stateKeyword === 'waiting') {
    return { runState: 'running', runStateLabel: '等待中' };
  }
  if (stateKeyword === 'running' || stateKeyword === 'a-b' || stateKeyword === 'b-a') {
    return { runState: 'running', runStateLabel: '运行中' };
  }
  if (stateKeyword === 'idle' || stateKeyword === 'unreturn') {
    return { runState: 'idle', runStateLabel: '空闲' };
  }
  if (stateKeyword === 'return' || stateKeyword === 'returning') {
    return { runState: 'returning', runStateLabel: '归位中' };
  }
  return { runState: 'unknown', runStateLabel: '状态未知' };
};

const formatAbnormalStatus = (rawData) => {
  const batteryAlarmMap = {
    0: '正常', 1: '满', 2: '过流', 3: '拔出', 4: '过压', 5: '欠流', 6: '电池电压过低'
  };
  const fanAlarmMap = {
    0: '正常', 1: '风扇1低于阈值', 2: '风扇2低于阈值', 3: '两个风扇均低于阈值', 5: '启动瞬间电流不足'
  };
  const batteryAlarm = findMetricValue(rawData, ['BatAlarm']);
  const fanAlarm = findMetricValue(rawData, ['FanAlarm']);
  if (batteryAlarm === null || fanAlarm === null) {
    return { abnormalStatus: '--', hasAlarm: false };
  }
  const alarms = [];
  if (batteryAlarm !== 0) alarms.push(batteryAlarmMap[batteryAlarm] || `未知(${batteryAlarm})`);
  if (fanAlarm !== 0) alarms.push(fanAlarmMap[fanAlarm] || `未知(${fanAlarm})`);
  return {
    abnormalStatus: alarms.length > 0 ? alarms.join('；') : '无异常',
    hasAlarm: alarms.length > 0
  };
};

const parseDeviceMetrics = (result) => {
  const rawData = typeof result?.data === 'string' ? result.data : '';
  return {
    battery: findMetricValue(rawData, ['BatLevel']),
    current: findMetricValue(rawData, ['I_Chg']),
    csq: findMetricValue(rawData, ['CSQ']),
    ...formatAbnormalStatus(rawData),
    ...parseRunState(rawData),
    rawData,
    timestamp: result?.timestamp || ''
  };
};

const fetchBoundDeviceStatuses = async (devices) => {
  const currentDevices = Array.isArray(devices) ? devices : [];
  if (currentDevices.length === 0) return;

  currentDevices.forEach(device => {
    device.statusLoading = true;
    device.statusError = '';
    device.identityMismatch = false;
    device.csq = null;
    device.csqSignalLevel = 0;
    if (['异常', '身份异常', '设备身份异常'].includes(device.abnormalStatus)) {
      device.abnormalStatus = '--';
      device.hasAlarm = false;
    }
  });

  const queryStatus = async () => {
    try {
      const result = await http.post('/api/devices/batchQueryStatus', {
        deviceCodes: currentDevices.map(device => device.deviceCode),
        timeout: 5000
      }, { timeout: 8000 });
      const statusMap = new Map((result?.results || []).map(item => [item.deviceCode, item]));

      currentDevices.forEach(device => {
        const status = statusMap.get(device.deviceCode);
        device.identityMismatch = Boolean(status?.identityMismatch);
        if (!status?.success) {
          device.online = 0;
          device.statusError = status?.error || '设备状态获取失败';
          device.runState = 'unknown';
          device.runStateLabel = '状态未知';
          return;
        }
        device.online = 1;
        const metrics = parseDeviceMetrics(status);
        device.battery = metrics.battery;
        device.current = metrics.current;
        device.csq = metrics.csq;
        device.csqSignalLevel = getCsqSignalLevel(metrics.csq);
        device.abnormalStatus = metrics.abnormalStatus;
        device.hasAlarm = metrics.hasAlarm;
        device.runState = metrics.runState;
        device.runStateLabel = metrics.runStateLabel;
        device.rawStatusData = metrics.rawData;
        device.statusTimestamp = metrics.timestamp;
      });
    } catch (error) {
      currentDevices.forEach(device => {
        device.online = 0;
        device.runState = 'unknown';
        device.runStateLabel = '状态未知';
        device.statusError = typeof error === 'string' ? error : '设备状态获取失败';
      });
    } finally {
      currentDevices.forEach(device => {
        device.statusLoading = false;
      });
    }
  };

  const request = boundStatusQueue.then(queryStatus, queryStatus);
  boundStatusQueue = request.catch(() => {});
  return request;
};

const getDeviceActionLabel = (device) => {
  if (device.switchLoading) return '操作中';
  if (device.runState === 'returning' || device.runState === 'unknown') return '不可操作';
  if (device.runState === 'running') return '暂停';
  return device.runState === 'paused' ? '继续' : '开始';
};

const handleDeviceAction = async (device) => {
  if (device.online !== 1) {
    uni.showToast({ title: '设备离线，无法操作', icon: 'none' });
    return;
  }
  if (device.statusLoading || device.runState === 'unknown' || device.runState === 'returning') {
    uni.showToast({ title: device.runState === 'returning' ? '设备归位中，请稍后操作' : '设备状态未确认，暂不可操作', icon: 'none' });
    return;
  }
  if (device.switchLoading) return;

  const action = device.runState === 'running' ? 'pause' : 'start';
  const command = DEVICE_ACTION_COMMANDS[action];

  device.switchLoading = true;
  try {
    await http.post('/api/devices/command', {
      deviceCode: device.deviceCode,
      type: 'send',
      params: { data: command },
      timeout: 10000
    }, { timeout: 12000 });
    device.runState = action === 'start' ? 'running' : 'paused';
    device.runStateLabel = action === 'start' ? '运行中' : '暂停';
    await fetchBoundDeviceStatuses([device]);
    uni.showToast({ title: action === 'start' ? '已下发开始指令' : '已下发暂停指令', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: typeof error === 'string' ? error : '操作失败',
      icon: 'none'
    });
  } finally {
    device.switchLoading = false;
  }
};

const formatMetric = (value, unit) => {
  if (value === null || value === undefined || value === '') return '--';
  return unit ? `${value} ${unit}` : String(value);
};

const formatBatteryLevel = (value) => {
  if (value === null || value === undefined || value === '') return '--';
  return `${value}%`;
};

const getMetricValueClass = (value, type) => {
  if (value === null || value === undefined || value === '') return '';

  const metric = Number(value);
  if (!Number.isFinite(metric)) return '';

  if (type === 'current') {
    if (metric < 5) return 'metric-value-danger';
    if (metric < 10) return 'metric-value-warning';
  } else if (type === 'voltage' && metric < 180) {
    return 'metric-value-danger';
  }

  return 'metric-value-success';
};

const fetchBoundDevices = async ({ throwOnError = false, refreshSummaryAfterStatus = true } = {}) => {
  boundLoading.value = true;
  try {
    const params = {
      page: boundPage.value,
      pageSize: DEVICE_PAGE_SIZE
    };
    if (selectedGroupId.value !== 'all') params.groupId = selectedGroupId.value;

    const result = await http.get('/api/users/devices', params);
    boundTotal.value = Number(result?.total) || 0;
    if (selectedGroupId.value === 'all') allBoundTotal.value = boundTotal.value;
    boundTotalPages.value = Number(result?.totalPages) || 0;
    boundDevices.value = (Array.isArray(result?.list) ? result.list : []).map(device => ({
      ...device,
      online: 0,
      battery: null,
      current: null,
      csq: null,
      csqSignalLevel: 0,
      abnormalStatus: '--',
      hasAlarm: false,
      identityMismatch: false,
      statusLoading: true,
      statusError: '',
      rawStatusData: '',
      statusTimestamp: '',
      runState: 'unknown',
      runStateLabel: '检测中',
      switchLoading: false
    }));
    // 卡片先显示，再异步查询当前页设备的实时状态；查询结果会同步回顶部汇总。
    if (refreshSummaryAfterStatus) {
      fetchBoundDeviceStatuses(boundDevices.value).finally(fetchDeviceSummary);
    } else {
      fetchBoundDeviceStatuses(boundDevices.value);
    }
  } catch (e) {
    boundDevices.value = [];
    boundTotal.value = 0;
    boundTotalPages.value = 0;
    if (!throwOnError) deviceSummary.value = createEmptyDeviceSummary();
    if (throwOnError) throw e;
  } finally {
    boundLoading.value = false;
  }
};

const changeBoundPage = async (page) => {
  if (boundLoading.value || page < 1 || page > boundTotalPages.value) return;
  boundPage.value = page;
  await fetchBoundDevices();
};

// ============ 蓝牙扫描（copy from index.vue）============
const editModalVisible = ref(false);
const editDeviceName = ref('');
const editingItem = ref(null);
const devices = ref([]);
const appVersion = ref('');

const BluetoothAdapter = plus.android.importClass("android.bluetooth.BluetoothAdapter");
const BluetoothDevice = plus.android.importClass("android.bluetooth.BluetoothDevice");
const IntentFilter = plus.android.importClass('android.content.IntentFilter');
let BAdapter = null;
let receiver = null;
let isConnecting = false;
let isRequestingBluetoothPermission = false;

const waitForDiscoveryStopped = (timeout = 1500) => new Promise(resolve => {
  const startedAt = Date.now();
  const check = () => {
    let isDiscovering = false;
    try { isDiscovering = BAdapter && BAdapter.isDiscovering(); } catch (e) { }
    if (!isDiscovering || Date.now() - startedAt >= timeout) return resolve();
    setTimeout(check, 100);
  };
  check();
});

const getConnectErrorMessage = (error) => {
  const message = String(error?.message || error || '');
  if (/permission|securityexception/i.test(message)) return '蓝牙权限不足，请检查系统授权';
  if (/timeout|timed out|read failed|socket might closed/i.test(message)) return '连接超时，请确认设备可连接后重试';
  return '连接失败，请确认设备已配对且在附近';
};

const getSignalLevel = (rssi) => {
  if (rssi >= -50) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -85) return 2;
  if (rssi < 0) return 1;
  return 0;
};

const getSignalColor = (level) => {
  if (level >= 3) return '#52C41A';
  if (level === 2) return '#FAAD14';
  if (level === 1) return '#FF4D4F';
  return '#E0E0E0';
};

const normalizeMac = (mac) => String(mac || '').replace(/[^0-9A-F]/gi, '').toUpperCase();

const loadSavedDevices = () => {
  const saved = uni.getStorageSync('SAVED_BLUETOOTH_DEVICES') || [];
  let hasMigration = false;
  devices.value = saved.map(d => {
    if (!d.remarkName) {
      d.remarkName = d.name || '未知设备';
      hasMigration = true;
    }
    return {
    name: d.name || '未知设备',
    initialName: d.initialName || d.name || '未知设备',
    remarkName: d.remarkName,
    mac: d.mac,
    addTime: d.addTime,
    canConnect: false,
    isAbnormal: (d.name || "").startsWith('HF-SPP') || (d.name || "").startsWith('JDY'),
    rssi: 0,
    signalLevel: 0,
    signalColor: '#E0E0E0',
    show: 'none'
    };
  });
  if (hasMigration) uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', saved);
};

const connectableCount = computed(() => devices.value.filter(d => d.canConnect).length);

const startSilentScan = () => {
  if (isRequestingBluetoothPermission) return;
  if (!BAdapter) BAdapter = BluetoothAdapter.getDefaultAdapter();
  if (!BAdapter) return;
  if (!BAdapter.isEnabled()) return uni.showToast({ title: '请开启蓝牙', icon: 'none' });

  // 与“添加新设备”页面保持一致：Android 11 及以下需要开启定位服务。
  const BuildVersion = plus.android.importClass('android.os.Build$VERSION');
  const sdkVersion = Number(BuildVersion.SDK_INT);
  if (sdkVersion < 31) {
    const Context = plus.android.importClass('android.content.Context');
    const LocationManager = plus.android.importClass('android.location.LocationManager');
    const main = plus.android.runtimeMainActivity();
    const locationService = main.getSystemService(Context.LOCATION_SERVICE);
    if (!locationService.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
      uni.showModal({
        title: '提示',
        content: '请在系统设置中开启定位服务(GPS)后搜索',
        showCancel: false
      });
      return;
    }
  }

  const permissions = sdkVersion >= 31
    ? ['android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT']
    : ['android.permission.ACCESS_FINE_LOCATION'];

  isRequestingBluetoothPermission = true;
  plus.android.requestPermissions(
    permissions,
    e => {
      isRequestingBluetoothPermission = false;
      if (e.deniedPresent.length > 0 || e.deniedAlways.length > 0) {
        uni.showToast({ title: sdkVersion >= 31 ? '需附近设备权限' : '需定位权限', icon: 'none' });
        return;
      }
      doScan();
    },
    e => {
      isRequestingBluetoothPermission = false;
      console.error('[蓝牙权限申请失败]', e);
      uni.showToast({ title: '蓝牙权限申请失败', icon: 'none' });
    }
  );
};

const doScan = () => {
  stopSilentScan();

  receiver = plus.android.implements('io.dcloud.android.content.BroadcastReceiver', {
    onReceive: (context, intent) => {
      plus.android.importClass(intent);
      const action = intent.getAction();
      if (action === BluetoothDevice.ACTION_FOUND) {
        const device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
        const name = device.getName();
        const mac = device.getAddress();
        const isTarget = name && (
          name.startsWith('HF-SPP') ||
          name.startsWith('LY-SPP') ||
          name.startsWith('JDY')
        );
        if (isTarget) {
          const match = devices.value.find(d => normalizeMac(d.mac) === normalizeMac(mac));
          if (!match) return;
          const rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, 0);
          match.canConnect = true;
          match.rssi = rssi;
          match.signalLevel = getSignalLevel(rssi);
          match.signalColor = getSignalColor(match.signalLevel);
        }
      } else if (action === BluetoothAdapter.ACTION_DISCOVERY_FINISHED) {
        stopSilentScan();
      }
    }
  });

  const filter = new IntentFilter();
  filter.addAction(BluetoothDevice.ACTION_FOUND);
  filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
  plus.android.runtimeMainActivity().registerReceiver(receiver, filter);
  if (!BAdapter.startDiscovery()) {
    stopSilentScan();
    uni.showToast({ title: '蓝牙搜索启动失败，请重试', icon: 'none' });
  }
};

const stopSilentScan = () => {
  try {
    if (BAdapter?.isDiscovering()) BAdapter.cancelDiscovery();
    if (receiver) { plus.android.runtimeMainActivity().unregisterReceiver(receiver); receiver = null; }
  } catch (e) { }
};

const handleBoundDeviceNameUpdated = (payload) => {
  const device = boundDevices.value.find(item => item.deviceCode === payload?.deviceCode);
  if (device) device.remarkName = payload.remarkName || null;
};

onMounted(() => {
  uni.$on('UPDATE_NETWORK_DEVICE_NAME', handleBoundDeviceNameUpdated);
  uni.getSystemInfo({
    success: (res) => { appVersion.value = res.appWgtVersion; }
  });
});

onShow(() => {
  fetchBoundDevices();
  fetchDeviceSummary();
  fetchDeviceGroups();
  loadSavedDevices();
  // 关闭旧连接，释放设备让其恢复广播
	try { getApp().globalData?.sppSocket?.close(); getApp().globalData.sppSocket = null; } catch (e) {}
	startSilentScan();
});

onHide(stopSilentScan);
onUnmounted(() => {
  stopSilentScan();
  uni.$off('UPDATE_NETWORK_DEVICE_NAME', handleBoundDeviceNameUpdated);
});

// ============ 滑动操作 ============
const swipeOptions = ref([
  { text: '编辑', style: { backgroundColor: '#FF8C00' } },
  { text: '删除', style: { backgroundColor: '#FF4D4F' } }
]);

const onSwipeClick = (e, item) => {
  if (e.index === 1) {
    uni.showModal({
      title: '确认删除', content: `确定要删除 "${item.name}" 吗？`, confirmColor: '#FF4D4F',
      success: res => {
        if (res.confirm) {
          devices.value = devices.value.filter(d => d.mac !== item.mac);
          uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', devices.value.map(({ name, initialName, remarkName, deviceCode, mac, addTime }) => ({ name, initialName, remarkName, deviceCode, mac, addTime })));
          uni.showToast({ title: '已删除', icon: 'success' });
        } else { item.show = 'none'; }
      }
    });
  } else if (e.index === 0) {
    editingItem.value = item; editDeviceName.value = item.remarkName || ''; editModalVisible.value = true; item.show = 'none';
  }
};

const closeEditModal = () => { editModalVisible.value = false; devices.value.forEach(d => d.show = 'none'); };

const confirmEdit = async () => {
  const newName = editDeviceName.value.trim();
  const match = devices.value.find(d => d.mac === editingItem.value.mac);
  const previousRemarkName = match?.remarkName || '';
  if (match) match.remarkName = newName;
  const saved = uni.getStorageSync('SAVED_BLUETOOTH_DEVICES') || [];
  const sItem = saved.find(d => d.mac === editingItem.value.mac);
  if (sItem) { sItem.remarkName = newName; sItem.initialName = sItem.initialName || sItem.name; }
  if (sItem?.deviceCode && uni.getStorageSync('AUTH_TOKEN')) {
    try {
      await http.post('/api/users/updateDeviceRemark', { deviceCode: sItem.deviceCode, remarkName: newName });
    } catch (error) {
      if (match) match.remarkName = previousRemarkName;
      uni.showToast({ title: typeof error === 'string' ? error : '备注名称保存失败', icon: 'none' });
      return;
    }
  }
  uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', saved);
  uni.showToast({ title: '备注名称已保存', icon: 'success' });
  closeEditModal();
};

const toDeviceDetail = item => {
  if (!item.canConnect) return uni.showToast({ title: '设备不可连', icon: 'none' });
  if (isConnecting) return;
  isConnecting = true;
  stopSilentScan();
  uni.showLoading({ title: '正在连接...', mask: true });
  waitForDiscoveryStopped().then(() => {
    let socket = null;
    try {
      try { getApp().globalData?.sppSocket?.close(); } catch (e) { }
      getApp().globalData.sppSocket = null;
      if (!BAdapter) BAdapter = BluetoothAdapter.getDefaultAdapter();
      const remoteDevice = BAdapter.getRemoteDevice(item.mac);
      plus.android.importClass(remoteDevice);
      const UUID = plus.android.importClass("java.util.UUID");
      socket = remoteDevice.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"));
      plus.android.importClass(socket);
      socket.connect();
      if (!socket.isConnected()) throw new Error('Socket 未连接');
      getApp().globalData.sppSocket = socket;
      uni.navigateTo({ url: `/pages/deviceState/index?name=${encodeURIComponent(item.remarkName || '未知设备')}&initialName=${encodeURIComponent(item.initialName || item.name)}&remarkName=${encodeURIComponent(item.remarkName || '')}&mac=${item.mac}` });
    } catch (e) {
      console.error('[蓝牙连接失败]', e);
      try { socket?.close(); } catch (closeError) { }
      uni.showToast({ title: getConnectErrorMessage(e), icon: 'none' });
    } finally {
      isConnecting = false;
      uni.hideLoading();
    }
  });
};

const goMine = () => { uni.navigateTo({ url: '/pages/mine/index' }); };

const addDevice = () => { stopSilentScan(); uni.navigateTo({ url: '/pages/index/bluetooth' }); };

const handleManualRefresh = () => {
  if (manualRefreshLoading.value) return;
  manualRefreshLoading.value = true;
  uni.showLoading({ title: '正在刷新...', mask: true });
  stopSilentScan();
  try { getApp().globalData?.sppSocket?.close(); getApp().globalData.sppSocket = null; } catch (e) { }
  devices.value = [];
  setTimeout(async () => {
    try {
      loadSavedDevices();
      // 关闭旧连接，释放设备让其恢复广播
      try { getApp().globalData?.sppSocket?.close(); getApp().globalData.sppSocket = null; } catch (e) { }
      startSilentScan();
      const results = await Promise.allSettled([
        fetchBoundDevices({ throwOnError: true, refreshSummaryAfterStatus: false }),
        fetchDeviceSummary(true),
        fetchDeviceGroups(true),
      ]);
      const failedNames = ['设备列表', '设备统计', '设备分组'].filter((name, index) => results[index].status === 'rejected');
      if (failedNames.length === 0) uni.showToast({ title: '刷新成功', icon: 'success' });
      else uni.showToast({ title: `${failedNames.join('、')}刷新失败`, icon: 'none' });
    } catch (error) {
      uni.showToast({ title: '刷新失败', icon: 'none' });
    } finally {
      uni.hideLoading();
      manualRefreshLoading.value = false;
    }
  }, 500);
};

const fetchAllSelectedBoundDeviceCodes = async () => {
  const baseParams = { page: 1, pageSize: 100 };
  if (selectedGroupId.value !== 'all') baseParams.groupId = selectedGroupId.value;

  const firstPage = await http.get('/api/users/devices', baseParams);
  const devices = Array.isArray(firstPage?.list) ? [...firstPage.list] : [];
  const totalPages = Number(firstPage?.totalPages) || 0;

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await http.get('/api/users/devices', { ...baseParams, page });
    if (Array.isArray(result?.list)) devices.push(...result.list);
  }

  return [...new Set(devices.map(device => String(device?.deviceCode || '').trim()).filter(Boolean))];
};

const sendBatchDeviceCommand = async (command, actionLabel) => {
  if (batchCommandLoading.value) return;
  if (isBoundStatusChecking.value) {
    uni.showToast({ title: '正在检测设备状态，请稍后操作', icon: 'none' });
    return;
  }

  batchCommandLoading.value = true;
  uni.showLoading({ title: `正在全部${actionLabel}...`, mask: true });
  try {
    const deviceCodes = await fetchAllSelectedBoundDeviceCodes();
    if (deviceCodes.length === 0) {
      uni.showToast({ title: '暂无可操作设备', icon: 'none' });
      return;
    }
    await http.post('/api/devices/batchCommand', {
      deviceCodes,
      type: 'send',
      // 批量透传按协议原样下发，不附加换行符。
      params: { data: command }
    });
    uni.hideLoading();
    uni.showToast({ title: '下发成功', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: typeof error === 'string' ? error : `全部${actionLabel}失败`,
      icon: 'none'
    });
  } finally {
    batchCommandLoading.value = false;
    uni.hideLoading();
  }
};

const turnAllOn = () => sendBatchDeviceCommand('$h=1\n', '开始');

const turnAllOff = () => sendBatchDeviceCommand('$h=0\n', '暂停');

const toBoundDevice = (item) => {
  if (item?.statusLoading) {
    uni.showToast({ title: '正在检测设备状态，请稍后进入', icon: 'none' });
    return;
  }
  if (item?.online !== 1) {
    uni.showToast({ title: '设备离线，无法进入详情', icon: 'none' });
    return;
  }
  if (!item?.deviceCode) {
    uni.showToast({ title: '设备编号缺失', icon: 'none' });
    return;
  }

  const name = item.remarkName || '--';
  uni.navigateTo({
    url: `/pages/networkDeviceState/index?from=device-list&deviceCode=${encodeURIComponent(item.deviceCode)}&name=${encodeURIComponent(name)}&remarkName=${encodeURIComponent(item.remarkName || '')}&identityMismatch=${item.identityMismatch ? '1' : '0'}&abnormalStatus=${encodeURIComponent(item.abnormalStatus || '--')}&hasAlarm=${item.hasAlarm ? '1' : '0'}`
  });
};
</script>

<style lang="scss" scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: #F6F7FB;
  overflow: hidden;
}

/* ===== 顶部（copy from index.vue）===== */
.mask-content {
  position: relative;
  z-index: 100;
  flex-shrink: 0;
  padding: 0 30rpx;
  box-sizing: border-box;
  padding-top: calc(var(--status-bar-height) + 40rpx);
  background: radial-gradient(circle at top right, $primary-color, $primary-dark);
  border-radius: 0 0 60rpx 60rpx;
  box-shadow: 0 10rpx 40rpx rgba($primary-color, 0.2);
}

.header {
  margin-bottom: 40rpx;
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.header-actions {
  display: flex;
  align-items: center;
}

.header-actions .refresh-btn {
  margin-left: 10rpx;
}

.page-title {
  font-size: 48rpx;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 2rpx;
}

.refresh-btn {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
  padding: 10rpx 28rpx;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 30rpx;
}

.page-subtitle {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.summary-board {
  background-color: #FFFFFF;
  border-radius: 32rpx;
  padding: 40rpx 0;
  display: flex;
  box-shadow: 0 15rpx 35rpx rgba(0, 0, 0, 0.08);
  margin-bottom: -15rpx;
  position: relative;
  z-index: 10;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.summary-item.border-line::before,
.summary-item.border-line::after {
  content: '';
  position: absolute;
  top: 20%;
  bottom: 20%;
  width: 2rpx;
  background-color: #F2F2F2;
}

.summary-item.border-line::before { left: 0; }
.summary-item.border-line::after { right: 0; }

.num {
  font-size: 40rpx;
  font-weight: 700;
  color: #333;
  margin-bottom: 8rpx;
}

.num.highlight { color: $primary-color; }
.num.warning { color: #FF4D4F; }

.label {
  font-size: 22rpx;
  color: #999;
}

/* ===== 滚动区域 ===== */
.main-scroll {
  flex: 1;
  height: 0;
  overflow-y: auto;
  padding: 0 30rpx;
  box-sizing: border-box;
}

.scroll-inner {
  padding-bottom: 20rpx;
}

/* ===== 通用区块 ===== */
.section {
  margin-top: 30rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.device-section {
  position: relative;
}

.section-actions {
  display: flex;
  align-items: center;
}

.section-actions .section-add-btn {
  margin-left: 16rpx;
}

.group-select {
  position: relative;
  min-width: 168rpx;
  max-width: 240rpx;
  height: 52rpx;
  padding: 0 18rpx;
  border: 1rpx solid #E8EAF0;
  border-radius: 17rpx;
  background: #FFFFFF;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  box-shadow: 0 3rpx 12rpx rgba(45, 49, 57, 0.04);

  &.open {
    z-index: 1002;
    border-color: rgba($primary-color, 0.45);

    .group-select-arrow {
      transform: rotate(225deg);
      margin-top: 5rpx;
    }
  }
}

.group-select-text {
  flex: 1;
  min-width: 0;
  font-size: 23rpx;
  line-height: 32rpx;
  color: #5E6166;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-select-arrow {
  width: 10rpx;
  height: 10rpx;
  flex-shrink: 0;
  margin-left: 12rpx;
  margin-top: -5rpx;
  border-right: 3rpx solid #969CA7;
  border-bottom: 3rpx solid #969CA7;
  transform: rotate(45deg);
  transition: transform 0.18s ease, margin-top 0.18s ease;
}

.group-dropdown {
  position: absolute;
  right: 0;
  top: 64rpx;
  width: 280rpx;
  max-height: 420rpx;
  padding: 10rpx;
  border: 1rpx solid #ECEEF2;
  border-radius: 20rpx;
  background: #FFFFFF;
  box-sizing: border-box;
  overflow-y: auto;
  box-shadow: 0 16rpx 40rpx rgba(45, 49, 57, 0.14);
  z-index: 1003;
}

.group-option {
  min-height: 68rpx;
  padding: 0 18rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &.selected {
    background: #FFF4E6;

    .group-option-name,
    .group-option-count {
      color: $primary-color;
      font-weight: 600;
    }
  }

  &:active {
    background: #F6F7F9;
  }
}

.group-option-name {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: #4A4E55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-option-count {
  margin-left: 16rpx;
  font-size: 21rpx;
  color: #AAB0BB;
}

.group-option-empty {
  padding: 24rpx 16rpx;
  text-align: center;
  font-size: 22rpx;
  color: #AAB0BB;
}

.group-dropdown-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
}

.batch-row {
  display: flex;
  margin-bottom: 24rpx;
}

.batch-btn {
  flex: 1;
  height: 80rpx;
  background: linear-gradient(135deg, $primary-color, $primary-dark);
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 20rpx rgba($primary-color, 0.2);
  margin-right: 20rpx;

  .batch-btn-text {
    font-size: 28rpx;
    font-weight: 600;
    color: #FFFFFF;
  }

  &.batch-btn-off {
    background: #F0F1F5;
    box-shadow: none;
    margin-right: 0;

    .batch-btn-text { color: #5E6166; }
  }

  &:active { opacity: 0.85; transform: scale(0.98); }

  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #2D3139;
}

.section-count {
  font-size: 24rpx;
  color: #AAB0BB;
}

.section-add-btn {
  width: 52rpx;
  height: 52rpx;
  border-radius: 17rpx;
  background: linear-gradient(135deg, #FFA53D, $primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 5rpx 14rpx rgba(247, 150, 25, 0.24);

  &:active {
    opacity: 0.82;
    transform: scale(0.94);
  }
}

.section-add-icon {
  position: relative;
  width: 22rpx;
  height: 22rpx;

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    border-radius: 3rpx;
    background: #FFFFFF;
    transform: translate(-50%, -50%);
  }

  &::before {
    width: 22rpx;
    height: 4rpx;
  }

  &::after {
    width: 4rpx;
    height: 22rpx;
  }
}

.loading-text {
  font-size: 26rpx;
  color: #B0B5C1;
  padding: 20rpx 0;
  display: block;
}

.bound-empty {
  padding: 52rpx 0 58rpx;
  text-align: center;

  text {
    font-size: 25rpx;
    color: #AAB0BB;
  }
}

.bound-pagination {
  margin-top: 4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pagination-btn {
  min-width: 112rpx;
  height: 58rpx;
  padding: 0 20rpx;
  border: 1rpx solid #E5E8ED;
  border-radius: 18rpx;
  background: #FFFFFF;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  color: #565B64;

  &.disabled {
    background: #F3F4F6;
    color: #B9BEC7;
  }
}

.pagination-info {
  min-width: 100rpx;
  margin: 0 18rpx;
  text-align: center;
  font-size: 23rpx;
  color: #8B919B;
}

/* ===== 已绑定设备 ===== */
.bound-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.bound-card {
  width: calc(50% - 12rpx);
  margin-bottom: 24rpx;
  background: #FFFFFF;
  border: 1rpx solid rgba(45, 49, 57, 0.04);
  border-radius: 24rpx;
  padding: 20rpx;
  box-sizing: border-box;
  box-shadow: 0 5rpx 20rpx rgba(45, 49, 57, 0.05);
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &:active {
    transform: scale(0.985);
    box-shadow: 0 3rpx 14rpx rgba(45, 49, 57, 0.04);
  }
}

.section-title-wrap {
  display: flex;
  align-items: center;
  min-width: 0;
}

.device-checking-hint {
  display: inline-flex;
  align-items: center;
  margin-left: 12rpx;
  color: #6E8DF4;
  font-size: 20rpx;
  white-space: nowrap;
}

.device-checking-spinner {
  width: 16rpx;
  height: 16rpx;
  margin-right: 6rpx;
  border: 2rpx solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: online-status-spin .8s linear infinite;
}

.bound-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bound-icon {
  position: relative;
  width: 64rpx;
  height: 64rpx;
  flex-shrink: 0;
  border-radius: 18rpx;
  background: #F2F4F7;
  display: flex;
  align-items: center;
  justify-content: center;

  .iconfont {
    font-size: 38rpx;
    color: #B0B5C1;
  }

  &.online {
    background: linear-gradient(145deg, #FFF5E9, #FFE8CC);

    .iconfont {
      color: $primary-color;
    }
  }

  &.checking {
    background: #EEF2FF;

    .iconfont {
      color: #6E8DF4;
    }
  }
}

.connection-dot {
  position: absolute;
  right: -3rpx;
  bottom: -3rpx;
  width: 14rpx;
  height: 14rpx;
  border: 3rpx solid #FFFFFF;
  border-radius: 50%;
  background: #C7CCD5;
  box-sizing: content-box;

  &.online {
    background: #52C41A;
  }

  &.checking {
    background: #6E8DF4;
    animation: online-status-pulse 1s ease-in-out infinite;
  }
}

.device-control {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.device-state-info {
  min-width: 64rpx;
  height: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.device-state-caption {
  margin-bottom: 3rpx;
  font-size: 17rpx;
  line-height: 1;
  color: #98A2B3;
}

.device-state-value {
  max-width: 100rpx;
  font-size: 20rpx;
  line-height: 1;
  font-weight: 600;
  color: #6B7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.running {
    color: #E58A13;
  }

  &.paused {
    color: #3A8DFF;
  }

  &.returning {
    color: #C88124;
  }

  &.unknown {
    color: #98A2B3;
  }
}

.device-action-button {
  min-width: 74rpx;
  height: 44rpx;
  margin-left: 14rpx;
  flex-shrink: 0;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: $primary-color;
  box-sizing: border-box;
  color: #FFFFFF;
  font-size: 21rpx;
  font-weight: 600;
  transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;

  &.disabled {
    background: #D7DCE5;
    color: #8B95A3;
    opacity: 0.7;
  }

  &:active:not(.disabled) {
    opacity: 0.8;
  }
}

.bound-info {
  min-width: 0;
  margin-top: 14rpx;
}

.bound-name {
  font-size: 27rpx;
  font-weight: 700;
  color: #2D3139;
  display: block;
  line-height: 38rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes online-status-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes online-status-pulse {
  50% {
    opacity: 0.35;
    transform: scale(0.82);
  }
}

.bound-metrics {
  margin-top: 16rpx;
  padding: 14rpx 4rpx;
  border-radius: 16rpx;
  background: #F7F8FA;
  display: flex;
  align-items: center;
}

.bound-metric {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-label {
  font-size: 19rpx;
  color: #9CA3AF;
  margin-bottom: 6rpx;
}

.metric-value {
  font-size: 25rpx;
  line-height: 32rpx;
  font-weight: 700;
  color: #2D3139;
}

.metric-value-success {
  color: #52C41A;
}

.metric-value-warning {
  color: #FA8C16;
}

.metric-value-danger {
  color: #FF4D4F;
}

.metric-divider {
  width: 1rpx;
  height: 40rpx;
  background: #E4E7EC;
}

.mode-row {
  margin-top: 12rpx;
  padding: 11rpx 13rpx;
  border-radius: 14rpx;
  background: #FFF8EF;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mode-label {
  font-size: 19rpx;
  color: #A98257;
}

.mode-value {
  max-width: 210rpx;
  font-size: 22rpx;
  line-height: 30rpx;
  font-weight: 700;
  color: $primary-color;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  white-space: normal;

  &.abnormal {
    color: #FF4D4F;
  }

  &.normal {
    color: #159570;
  }
}

/* ===== 蓝牙设备卡片 ===== */
.device-card-container {
  width: 100%;
  padding: 10rpx;
  box-sizing: border-box;
}

.device-card {
  background-color: #FFFFFF;
  border-radius: 32rpx;
  padding: 24rpx 30rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 2rpx 10rpx rgba(45, 49, 57, 0.025), 0 10rpx 28rpx rgba(45, 49, 57, 0.025);
  transition: all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28);

  &:active {
    transform: scale(0.96);
    box-shadow: 0 2rpx 8rpx rgba(45, 49, 57, 0.02);
  }
}

.device-icon-box {
  width: 80rpx;
  height: 80rpx;
  background-color: #F8F9FB;
  border-radius: 24rpx;
  margin-right: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-bt-icon {
  font-size: 40rpx;
  color: $primary-color;
}

.device-info {
  flex: 1;
}

.info-top {
  display: flex;
  align-items: center;
  margin-bottom: 4rpx;
}

.d-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #2D3139;
  margin-right: 12rpx;
}

.abnormal-tag {
  font-size: 18rpx;
  background-color: #FF4D4F;
  color: #FFFFFF;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  flex-shrink: 0;
}

.info-bottom {
  display: flex;
  align-items: center;
}

.d-id {
  font-size: 22rpx;
  color: #AAB0BB;
}

.device-action {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 20rpx;
}

.signal-box {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 8rpx;
}

.signal-icon {
  display: flex;
  align-items: flex-end;
  height: 32rpx;
}

.signal-bar {
  width: 8rpx;
  background-color: #E0E0E0;
  border-radius: 2rpx;
}

.signal-bar + .signal-bar {
  margin-left: 4rpx;
}

.signal-bar:nth-child(1) { height: 12rpx; }
.signal-bar:nth-child(2) { height: 20rpx; }
.signal-bar:nth-child(3) { height: 28rpx; }
.signal-bar:nth-child(4) { height: 36rpx; }

.d-status {
  font-size: 22rpx;
  color: #52C41A;
  font-weight: 600;
}

.empty-tip {
  padding: 60rpx 0;
  text-align: center;

  text {
    font-size: 26rpx;
    color: #B0B5C1;
  }
}

/* ===== 底部 ===== */
.footer-action {
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 20rpx 30rpx;
  padding-bottom: calc(env(safe-area-inset-bottom) + 30rpx);
  background: linear-gradient(to top, #F6F7FB 85%, rgba(246, 247, 251, 0));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.add-btn {
  width: 100%;
  height: 110rpx;
  background: linear-gradient(135deg, $primary-color, $primary-dark);
  color: #FFFFFF;
  border-radius: 55rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 600;
  border: none;
  box-shadow: 0 15rpx 30rpx rgba($primary-color, 0.4);
  margin-bottom: 15rpx;

  .plus { font-size: 44rpx; margin-right: 12rpx; margin-top: -4rpx; }

  &::after { border: none; }

  &:active { opacity: 0.9; transform: scale(0.98); }
}

.company-text {
  font-size: 22rpx;
  color: #BEC4CC;
  letter-spacing: 2rpx;
}

/* ===== 新建设备分组弹窗 ===== */
.group-modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  padding: 30rpx;
  box-sizing: border-box;
  background: rgba(27, 31, 38, 0.48);
  backdrop-filter: blur(8rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1300;
}

.group-modal {
  width: 650rpx;
  max-width: 100%;
  max-height: 86vh;
  border-radius: 32rpx;
  background: #FFFFFF;
  overflow: hidden;
  box-shadow: 0 24rpx 70rpx rgba(26, 30, 36, 0.2);
}

.group-modal-header {
  padding: 32rpx 32rpx 24rpx;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.group-modal-title,
.group-modal-subtitle {
  display: block;
}

.group-modal-title {
  font-size: 34rpx;
  line-height: 46rpx;
  font-weight: 700;
  color: #2D3139;
}

.group-modal-subtitle {
  margin-top: 4rpx;
  font-size: 22rpx;
  line-height: 32rpx;
  color: #A0A6B1;
}

.group-modal-close {
  width: 52rpx;
  height: 52rpx;
  margin-left: 20rpx;
  border-radius: 16rpx;
  background: #F4F5F7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  line-height: 48rpx;
  font-weight: 300;
  color: #858B96;
}

.group-modal-body {
  padding: 0 32rpx 28rpx;
}

.group-field-label {
  font-size: 24rpx;
  line-height: 34rpx;
  font-weight: 600;
  color: #545860;
}

.group-name-input-wrap {
  height: 82rpx;
  margin-top: 12rpx;
  padding: 0 24rpx;
  border: 2rpx solid #ECEEF2;
  border-radius: 18rpx;
  background: #F8F9FB;
  box-sizing: border-box;
  display: flex;
  align-items: center;

  &:focus-within {
    border-color: rgba($primary-color, 0.5);
    background: #FFFFFF;
    box-shadow: 0 0 0 6rpx rgba($primary-color, 0.08);
  }
}

.group-name-input {
  width: 100%;
  font-size: 28rpx;
  color: #2D3139;
}

.group-device-title-row {
  margin-top: 28rpx;
  margin-bottom: 12rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.group-selected-count {
  font-size: 22rpx;
  color: $primary-color;
}

.group-device-list {
  height: 400rpx;
}

.group-device-loading {
  padding: 60rpx 0;
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #AAB0BB;
}

.group-device-item {
  min-height: 88rpx;
  margin-bottom: 12rpx;
  padding: 14rpx 16rpx;
  border: 2rpx solid #EEF0F3;
  border-radius: 18rpx;
  background: #FFFFFF;
  box-sizing: border-box;
  display: flex;
  align-items: center;

  &.selected {
    border-color: rgba($primary-color, 0.48);
    background: #FFF9F2;
  }
}

.group-device-icon {
  width: 56rpx;
  height: 56rpx;
  flex-shrink: 0;
  border-radius: 16rpx;
  background: #F0F2F5;
  display: flex;
  align-items: center;
  justify-content: center;

  .iconfont {
    font-size: 32rpx;
    color: #AEB4BE;
  }

  &.online {
    background: #FFF0DD;

    .iconfont {
      color: $primary-color;
    }
  }
}

.group-device-info {
  flex: 1;
  min-width: 0;
  margin: 0 18rpx;
}

.group-device-name,
.group-device-code {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-device-name {
  font-size: 25rpx;
  line-height: 34rpx;
  font-weight: 600;
  color: #353941;
}

.group-device-code {
  margin-top: 2rpx;
  font-size: 19rpx;
  line-height: 28rpx;
  color: #A0A6B1;
}

.group-device-check {
  position: relative;
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
  border: 2rpx solid #D9DDE4;
  border-radius: 11rpx;
  box-sizing: border-box;

  &.checked {
    border-color: $primary-color;
    background: $primary-color;

    .group-device-checkmark {
      opacity: 1;
    }
  }
}

.group-device-checkmark {
  position: absolute;
  left: 11rpx;
  top: 5rpx;
  width: 9rpx;
  height: 16rpx;
  border-right: 3rpx solid #FFFFFF;
  border-bottom: 3rpx solid #FFFFFF;
  opacity: 0;
  transform: rotate(45deg);
}

.group-device-empty {
  padding: 60rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #AAB0BB;
}

.group-device-pagination {
  margin-top: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.group-page-btn {
  min-width: 104rpx;
  height: 52rpx;
  padding: 0 18rpx;
  border: 1rpx solid #E5E8ED;
  border-radius: 16rpx;
  background: #FFFFFF;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: #565B64;

  &.disabled {
    background: #F3F4F6;
    color: #B9BEC7;
  }
}

.group-page-info {
  min-width: 88rpx;
  margin: 0 16rpx;
  text-align: center;
  font-size: 22rpx;
  color: #8B919B;
}

.group-modal-footer {
  padding: 22rpx 32rpx 30rpx;
  border-top: 1rpx solid #EEF0F3;
  display: flex;
}

.group-cancel-btn,
.group-create-btn {
  flex: 1;
  height: 82rpx;
  margin: 0;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 27rpx;
  font-weight: 600;

  &::after {
    border: none;
  }
}

.group-cancel-btn {
  margin-right: 20rpx;
  background: #F1F3F6;
  color: #656A73;
}

.group-create-btn {
  background: linear-gradient(135deg, #FFA53D, $primary-color);
  color: #FFFFFF;
  box-shadow: 0 7rpx 18rpx rgba(247, 150, 25, 0.22);

  &[disabled] {
    opacity: 0.6;
  }
}

/* ===== 编辑弹窗 ===== */
.custom-modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  backdrop-filter: blur(8rpx);

  &.show { opacity: 1; pointer-events: auto; }
}

.custom-modal {
  width: 600rpx;
  background: #FFFFFF;
  border-radius: 40rpx;
  overflow: hidden;
  transform: scale(0.9);
  transition: transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15);

  &.slide-up { transform: scale(1); }
}

.modal-header { padding: 40rpx 40rpx 20rpx; text-align: center; }

.modal-title { font-size: 36rpx; font-weight: 700; color: #2D3139; }

.modal-body { padding: 20rpx 40rpx 40rpx; }

.modal-body .input-wrap {
  background: #F6F7FB;
  border-radius: 20rpx;
  padding: 24rpx 30rpx;
  border: 2rpx solid transparent;
  transition: all 0.2s;

  &:focus-within { border-color: rgba($primary-color, 0.4); background: #FFFFFF; box-shadow: 0 0 0 6rpx rgba($primary-color, 0.08); }
}

.modern-input { font-size: 30rpx; color: #333; width: 100%; }

.modal-footer {
  display: flex;
  border-top: 2rpx solid #F2F2F2;
}

.modal-footer .btn {
  flex: 1;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: 600;
  background: transparent;

  &::after { border: none; }
}

.btn-cancel { color: #5E6166; border-right: 2rpx solid #F2F2F2; }
.btn-confirm { color: $primary-color; }

.btn:active { background: #F8F9FA; }
</style>
