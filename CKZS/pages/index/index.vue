<template>
	<view class="page-wrapper">
		<view class="mask-content">
			<view class="header">
				<view class="header-main">
					<text class="page-title">设备控制中心</text>
					<view class="header-actions">
						<view class="header-login-btn" @click="goLogin">登录</view>
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

		<view class="device-list-scroll">
			<view class="list-inner">
				<uni-swipe-action>
					<uni-swipe-action-item v-for="item in devices" :key="item.mac" :right-options="swipeOptions"
						:show="item.show" @change="item.show = $event" @click="onSwipeClick($event, item)">
						<view class="device-card-container">
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
												:style="{ backgroundColor: item.signalLevel >= 1 ? item.signalColor : '#E0E0E0' }">
											</view>
											<view class="signal-bar" :class="{ 'active': item.signalLevel >= 2 }"
												:style="{ backgroundColor: item.signalLevel >= 2 ? item.signalColor : '#E0E0E0' }">
											</view>
											<view class="signal-bar" :class="{ 'active': item.signalLevel >= 3 }"
												:style="{ backgroundColor: item.signalLevel >= 3 ? item.signalColor : '#E0E0E0' }">
											</view>
											<view class="signal-bar" :class="{ 'active': item.signalLevel >= 4 }"
												:style="{ backgroundColor: item.signalLevel >= 4 ? item.signalColor : '#E0E0E0' }">
											</view>
										</view>
									</view>
									<text class="d-status">可连接</text>
								</view>
							</view>
						</view>
					</uni-swipe-action-item>
				</uni-swipe-action>
			</view>
		</view>

		<view class="footer-action">
			<button class="add-btn" @click="addDevice">
				<text class="plus">+</text>
				<text>添加新设备</text>
			</button>
			<text class="company-text">APP版本: {{ appVersion }}</text>
		</view>

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
import { ref, computed, onUnmounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';

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
		if (receiver) {
			plus.android.runtimeMainActivity().unregisterReceiver(receiver);
			receiver = null;
		}
	} catch (e) { }
};

onShow(() => {
	uni.getSystemInfo({
		success: (res) => {
			appVersion.value = res.appWgtVersion;
		},
		fail: (err) => {
			console.error('获取系统信息失败', err);
		}
	});
	loadSavedDevices();
	// 关闭旧连接，释放设备让其恢复广播
	try { getApp().globalData?.sppSocket?.close(); getApp().globalData.sppSocket = null; } catch (e) {}
	startSilentScan();
});

onHide(stopSilentScan);
onUnmounted(stopSilentScan);

const swipeOptions = ref([
	{ text: '编辑', style: { backgroundColor: '#FF8C00' } },
	{ text: '删除', style: { backgroundColor: '#FF4D4F' } }
]);

const onSwipeClick = (e, item) => {
	if (e.index === 1) {
		uni.showModal({
			title: '确认删除',
			content: `确定要删除 "${item.name}" 吗？`,
			confirmColor: '#FF4D4F',
			success: res => {
				if (res.confirm) {
					devices.value = devices.value.filter(d => d.mac !== item.mac);
					uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', devices.value.map(({ name, mac, addTime }) => ({ name, mac, addTime })));
					uni.showToast({ title: '已删除', icon: 'success' });
				} else {
					item.show = 'none';
				}
			}
		});
	} else if (e.index === 0) {
		editingItem.value = item;
		editDeviceName.value = item.name;
		editModalVisible.value = true;
		item.show = 'none';
	}
};

const closeEditModal = () => {
	editModalVisible.value = false;
	devices.value.forEach(d => d.show = 'none');
};

const confirmEdit = () => {
	const newName = editDeviceName.value.trim();
	if (!newName) return uni.showToast({ title: '名称必填', icon: 'none' });

	const match = devices.value.find(d => d.mac === editingItem.value.mac);
	if (match) {
		match.name = newName;
		match.isAbnormal = newName.startsWith('HF-SPP') || newName.startsWith('JDY');
	}

	const saved = uni.getStorageSync('SAVED_BLUETOOTH_DEVICES') || [];
	const sItem = saved.find(d => d.mac === editingItem.value.mac);
	if (sItem) {
		sItem.name = newName;
		uni.setStorageSync('SAVED_BLUETOOTH_DEVICES', saved);
	}

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

const goLogin = () => {
	uni.reLaunch({ url: '/pages/login/login' });
};

const addDevice = () => {
	stopSilentScan();
	uni.navigateTo({ url: '/pages/index/bluetooth' });
};

const handleManualRefresh = () => {
	uni.showLoading({ title: '正在刷新...', mask: true });
	stopSilentScan();
	try {
		getApp().globalData?.sppSocket?.close();
		getApp().globalData.sppSocket = null;
	} catch (e) { }

	devices.value = [];
	setTimeout(() => {
	loadSavedDevices();
	// 关闭旧连接，释放设备让其恢复广播
	try { getApp().globalData?.sppSocket?.close(); getApp().globalData.sppSocket = null; } catch (e) {}
	startSilentScan();
		uni.hideLoading();
		uni.showToast({ title: '重置成功', icon: 'success' });
	}, 500);
};
</script>

<style lang="scss" scoped>
.page-wrapper {
	display: flex;
	flex-direction: column;
	height: 100vh;
	width: 100vw;
	background-color: #F6F7FB;
	overflow: hidden;
}

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

	.header-main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12rpx;

		.header-actions {
			display: flex;
			align-items: center;
		}

		.header-login-btn {
			font-size: 28rpx;
			font-weight: 600;
			color: #fff;
			padding: 10rpx 28rpx;
			margin-right: 10rpx;
			background: rgba(255, 255, 255, 0.25);
			border-radius: 30rpx;

			&:active {
				opacity: 0.8;
				transform: scale(0.95);
			}
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

			&:active {
				opacity: 0.8;
				transform: scale(0.95);
			}
		}
	}

	.page-subtitle {
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.8);
	}
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

	.summary-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;

		&.border-line::before,
		&.border-line::after {
			content: '';
			position: absolute;
			top: 20%;
			bottom: 20%;
			width: 2rpx;
			background-color: #F2F2F2;
		}

		&.border-line::before {
			left: 0;
		}

		&.border-line::after {
			right: 0;
		}

		.num {
			font-size: 40rpx;
			font-weight: 700;
			color: #333;
			margin-bottom: 8rpx;

			&.highlight {
				color: $primary-color;
			}

			&.warning {
				color: #FF4D4F;
			}
		}

		.label {
			font-size: 22rpx;
			color: #999;
		}
	}
}

.device-list-scroll {
	flex: 1;
	height: 0;
	overflow-y: auto;
	padding: 40rpx 20rpx 0 20rpx;

	.list-inner {
		padding-bottom: 20rpx;
	}
}

.device-card-container {
	padding: 10rpx;
	width: 100%;
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

	.device-icon-box {
		width: 80rpx;
		height: 80rpx;
		background-color: #F8F9FB;
		border-radius: 24rpx;
		margin-right: 24rpx;
		display: flex;
		align-items: center;
		justify-content: center;

			.device-bt-icon {
				font-size: 40rpx;
				color: $primary-color;
			}
		}

		.device-info {
		flex: 1;

		.info-top {
			display: flex;
			align-items: center;
			margin-bottom: 4rpx;

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
		}

		.info-bottom {
			display: flex;
			align-items: center;

			.d-id {
				font-size: 22rpx;
				color: #AAB0BB;
			}
		}
	}

	.device-action {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		margin-left: 20rpx;

		.signal-box {
			display: flex;
			align-items: center;
			justify-content: flex-end;
			margin-bottom: 8rpx;

			.signal-icon {
				display: flex;
				align-items: flex-end;
				height: 32rpx;

				.signal-bar {
					width: 8rpx;
					background-color: #E0E0E0;
					border-radius: 2rpx;

					& + .signal-bar {
						margin-left: 4rpx;
					}

					&:nth-child(1) {
						height: 12rpx;
					}

					&:nth-child(2) {
						height: 20rpx;
					}

					&:nth-child(3) {
						height: 28rpx;
					}

					&:nth-child(4) {
						height: 36rpx;
					}
				}
			}
		}

		.d-status {
			font-size: 22rpx;
			color: #52C41A;
			font-weight: 600;
		}
	}
}

.footer-action {
	flex-shrink: 0;
	width: 100%;
	box-sizing: border-box;
	padding: 20rpx 40rpx;
	padding-bottom: calc(env(safe-area-inset-bottom) + 30rpx);
	background: linear-gradient(to top, #F6F7FB 85%, rgba(246, 247, 251, 0));
	display: flex;
	flex-direction: column;
	align-items: center;

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

		.plus {
			font-size: 44rpx;
			margin-right: 12rpx;
			margin-top: -4rpx;
		}

		&:active {
			opacity: 0.9;
			transform: scale(0.98);
		}
	}

	.company-text {
		margin-top: 10rpx;
		font-size: 22rpx;
		color: #BEC4CC;
		letter-spacing: 2rpx;
	}
}

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

	&.show {
		opacity: 1;
		pointer-events: auto;
	}
}

.custom-modal {
	width: 600rpx;
	background: #FFFFFF;
	border-radius: 40rpx;
	overflow: hidden;
	transform: scale(0.9);
	transition: transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
	box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.15);

	&.slide-up {
		transform: scale(1);
	}

	.modal-header {
		padding: 40rpx 40rpx 20rpx;
		text-align: center;

		.modal-title {
			font-size: 36rpx;
			font-weight: 700;
			color: #2D3139;
		}
	}

	.modal-body {
		padding: 20rpx 40rpx 40rpx;

		.input-wrap {
			background: #F6F7FB;
			border-radius: 20rpx;
			padding: 24rpx 30rpx;
			border: 2rpx solid transparent;
			transition: all 0.2s;

			&:focus-within {
				border-color: rgba($primary-color, 0.4);
				background: #FFFFFF;
				box-shadow: 0 0 0 6rpx rgba($primary-color, 0.08);
			}

			.modern-input {
				font-size: 30rpx;
				color: #333;
				width: 100%;
			}
		}
	}

	.modal-footer {
		display: flex;
		border-top: 2rpx solid #F2F2F2;

		.btn {
			flex: 1;
			height: 100rpx;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 32rpx;
			font-weight: 600;
			background: transparent;

			&::after {
				border: none;
			}

			&.btn-cancel {
				color: #5E6166;
				border-right: 2rpx solid #F2F2F2;
			}

			&.btn-confirm {
				color: $primary-color;
			}

			&:active {
				background: #F8F9FA;
			}
		}
	}
}
</style>
