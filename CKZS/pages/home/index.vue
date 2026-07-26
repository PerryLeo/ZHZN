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
        <text class="page-subtitle">当前可连接 {{ connectableCount }} 台设备</text>
      </view>
      <view class="summary-board">
        <view class="summary-item">
          <text class="num">{{ devices.length }}</text>
          <text class="label">设备总数</text>
        </view>
        <view class="summary-item border-line">
          <text class="num highlight">{{ connectableCount }}</text>
          <text class="label">可连接</text>
        </view>
        <view class="summary-item">
          <text class="num warning">{{ abnormalCount }}</text>
          <text class="label">异常</text>
        </view>
      </view>
    </view>

    <view class="main-scroll">
      <view class="scroll-inner">
        <!-- ====== 已绑定设备 ====== -->
        <view class="section" v-if="boundLoading">
          <view class="section-header">
            <text class="section-title">我的设备</text>
          </view>
          <text class="loading-text">加载中...</text>
        </view>
        <view class="section" v-else-if="boundDevices.length > 0">
          <view class="section-header">
            <text class="section-title">我的设备</text>
            <text class="section-count">{{ boundDevices.length }} 台已绑定</text>
          </view>
          <view class="batch-row">
            <view class="batch-btn" @click="turnAllOn">
              <text class="batch-btn-text">全部开启</text>
            </view>
            <view class="batch-btn batch-btn-off" @click="turnAllOff">
              <text class="batch-btn-text">全部关闭</text>
            </view>
          </view>
          <view class="bound-grid">
            <view
              class="bound-card"
              v-for="item in boundDevices"
              :key="item.id"
              @click="toBoundDevice(item)"
            >
              <view class="bound-top">
                <view class="bound-icon" :class="{ online: item.online === 1 }">
                  <text class="iconfont icon-online bound-device-icon"></text>
                </view>
                <view class="bound-status">
                  <view class="status-dot" :class="{ on: item.online === 1 }"></view>
                  <text class="status-text">{{ item.online === 1 ? '在线' : '离线' }}</text>
                </view>
              </view>
              <text class="bound-name">{{ item.deviceName || item.deviceCode }}</text>
              <text class="bound-code">{{ item.deviceCode }}</text>
            </view>
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
              <view class="device-card" @click="toDeviceDetail(item)">
                <view class="device-icon-box">
                  <text class="iconfont icon-lanya device-bt-icon"></text>
                </view>
                <view class="device-info">
                  <view class="info-top">
                    <text class="d-name">{{ item.name }}</text>
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
          <text class="modal-title">修改设备名称</text>
        </view>
        <view class="modal-body">
          <view class="input-wrap">
            <input class="modern-input" v-model="editDeviceName" :focus="editModalVisible"
              placeholder="请输入新的设备名称" placeholder-style="color: #ccc;" />
          </view>
        </view>
        <view class="modal-footer">
          <button class="btn btn-cancel" @click="closeEditModal">取消</button>
          <button class="btn btn-confirm" @click="confirmEdit">确定</button>
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
const boundDevices = ref([]);

const boundLoading = ref(false);

const fetchBoundDevices = async () => {
  boundLoading.value = true;
  try {
    boundDevices.value = await http.get('/api/users/devices');
  } catch (e) {
    // 静默失败，不影响蓝牙功能
  } finally {
    boundLoading.value = false;
  }
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
  devices.value = (uni.getStorageSync('SAVED_BLUETOOTH_DEVICES') || []).map(d => ({
    name: d.name || '未知设备',
    mac: d.mac,
    addTime: d.addTime,
    canConnect: false,
    isAbnormal: (d.name || "").startsWith('HF-SPP') || (d.name || "").startsWith('JDY'),
    rssi: 0,
    signalLevel: 0,
    signalColor: '#E0E0E0',
    show: 'none'
  }));
};

const connectableCount = computed(() => devices.value.filter(d => d.canConnect).length);
const abnormalCount = computed(() => devices.value.filter(d => d.isAbnormal).length);

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

onMounted(() => {
  fetchBoundDevices();
  uni.getSystemInfo({
    success: (res) => { appVersion.value = res.appWgtVersion; }
  });
});

onShow(() => {
  loadSavedDevices();
  // 关闭旧连接，释放设备让其恢复广播
	try { getApp().globalData?.sppSocket?.close(); getApp().globalData.sppSocket = null; } catch (e) {}
	startSilentScan();
});

onHide(stopSilentScan);
onUnmounted(stopSilentScan);

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
          uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', devices.value.map(({ name, mac, addTime }) => ({ name, mac, addTime })));
          uni.showToast({ title: '已删除', icon: 'success' });
        } else { item.show = 'none'; }
      }
    });
  } else if (e.index === 0) {
    editingItem.value = item; editDeviceName.value = item.name; editModalVisible.value = true; item.show = 'none';
  }
};

const closeEditModal = () => { editModalVisible.value = false; devices.value.forEach(d => d.show = 'none'); };

const confirmEdit = () => {
  const newName = editDeviceName.value.trim();
  if (!newName) return uni.showToast({ title: '名称必填', icon: 'none' });
  const match = devices.value.find(d => d.mac === editingItem.value.mac);
  if (match) { match.name = newName; match.isAbnormal = newName.startsWith('HF-SPP') || newName.startsWith('JDY'); }
  const saved = uni.getStorageSync('SAVED_BLUETOOTH_DEVICES') || [];
  const sItem = saved.find(d => d.mac === editingItem.value.mac);
  if (sItem) { sItem.name = newName; uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', saved); }
  uni.showToast({ title: '修改成功', icon: 'success' });
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
      uni.navigateTo({ url: `/pages/deviceState/index?name=${encodeURIComponent(item.name)}&mac=${item.mac}` });
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
  uni.showLoading({ title: '正在刷新...', mask: true });
  stopSilentScan();
  try { getApp().globalData?.sppSocket?.close(); getApp().globalData.sppSocket = null; } catch (e) { }
  devices.value = [];
  setTimeout(() => { loadSavedDevices(); // 关闭旧连接，释放设备让其恢复广播
	try { getApp().globalData?.sppSocket?.close(); getApp().globalData.sppSocket = null; } catch (e) {}
	startSilentScan(); fetchBoundDevices(); uni.hideLoading(); uni.showToast({ title: '重置成功', icon: 'success' }); }, 500);
};

const turnAllOn = () => {
  // TODO
};

const turnAllOff = () => {
  // TODO
};

const toBoundDevice = (item) => {
  // 点击已绑定设备，暂不处理
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
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
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

.loading-text {
  font-size: 26rpx;
  color: #B0B5C1;
  padding: 20rpx 0;
  display: block;
}

/* ===== 已绑定设备 — 两列网格 ===== */
.bound-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.bound-card {
  width: calc(50% - 12rpx);
  margin-bottom: 24rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 28rpx 24rpx 24rpx;
  box-sizing: border-box;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);

  &:active {
    transform: scale(0.97);
  }
}

.bound-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.bound-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  background: #F5F6FA;
  display: flex;
  align-items: center;
  justify-content: center;

  .iconfont {
    font-size: 40rpx;
    color: #B0B5C1;
  }

  &.online {
    background: #FFF0E0;

    .iconfont {
      font-size: 40rpx;
      color: $primary-color;
    }
  }
}

.bound-status {
  display: flex;
  align-items: center;
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #D0D5DD;
  margin-right: 8rpx;

  &.on {
    background: #52C41A;
  }
}

.status-text {
  font-size: 22rpx;
  color: #AAB0BB;
}

.bound-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #2D3139;
  display: block;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bound-code {
  font-size: 20rpx;
  color: #B0B5C1;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 蓝牙设备卡片 ===== */
.device-card {
  width: 100%;
  box-sizing: border-box;
  background-color: #FFFFFF;
  border-radius: 32rpx;
  padding: 24rpx 30rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 16rpx;

  &:active {
    transform: scale(0.96);
    box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.02);
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
}

.d-id {
  font-size: 22rpx;
  color: #AAB0BB;
}

.device-action {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 10rpx;
}

.signal-icon {
  display: flex;
  align-items: flex-end;
  gap: 4rpx;
  height: 32rpx;
  margin-bottom: 8rpx;
}

.signal-bar {
  width: 8rpx;
  background-color: #E0E0E0;
  border-radius: 2rpx;
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
