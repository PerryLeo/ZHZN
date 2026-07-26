<template>
  <view class="page">
    <!-- 头部 -->
    <view class="header">
      <view class="header-spacer"></view>
      <view class="avatar">
        <text class="avatar-text">{{ initial }}</text>
      </view>
      <text class="username">{{ username }}</text>
      <text class="role-tag" v-if="isAdmin">管理员</text>
    </view>

    <!-- 信息卡片 -->
    <view class="card">
      <view class="card-row">
        <text class="row-label">用户名</text>
        <text class="row-value">{{ username }}</text>
      </view>
      <view class="card-divider"></view>
      <view class="card-row">
        <text class="row-label">角色</text>
        <text class="row-value">{{ isAdmin ? '管理员' : '普通用户' }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="actions">
      <view class="action-btn" @click="goChangePwd">
        <text class="action-text">修改密码</text>
        <text class="action-arrow iconfont icon-arrow-right"></text>
      </view>
      <view class="action-btn" v-if="isAdmin" @click="showResetModal = true">
        <text class="action-text admin-action">重置密码</text>
        <text class="action-arrow iconfont icon-arrow-right"></text>
      </view>
      <view class="action-btn danger" @click="handleLogout">
        <text class="action-text">退出登录</text>
        <text class="action-arrow iconfont icon-arrow-right"></text>
      </view>
    </view>

    <!-- 重置密码弹窗 -->
    <view class="modal-mask" v-if="showResetModal" @click="showResetModal = false">
      <view class="modal" @click.stop>
        <text class="modal-title">重置用户密码</text>
        <input class="modal-input" v-model="resetUsername" placeholder="请输入用户名" placeholder-style="color:#C0C4CC;" />
        <text class="modal-hint">密码将被重置为 123456</text>
        <view class="modal-btns">
          <view class="modal-btn cancel" @click="showResetModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn confirm" @click="handleResetPwd">
            <text>{{ resetting ? '提交中...' : '确定重置' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import http from '@/common/request.js';
import { TOKEN_KEY, USER_KEY } from '@/common/config.js';

const username = ref('');
const isAdmin = ref(false);
const showResetModal = ref(false);
const resetUsername = ref('');
const resetting = ref(false);

const initial = computed(() => (username.value || '?')[0].toUpperCase());

onMounted(() => {
  try {
    const info = JSON.parse(uni.getStorageSync('USER_INFO') || '{}');
    username.value = info.username || '';
    isAdmin.value = info.role === 'admin';
  } catch (e) { }
  fetchProfile();
});

const fetchProfile = async () => {
  try {
    const user = await http.get('/api/users/profile');
    username.value = user.username || '';
    isAdmin.value = user.role === 'admin';
  } catch (e) { }
};

const handleResetPwd = async () => {
  if (!resetUsername.value.trim()) return uni.showToast({ title: '请输入用户名', icon: 'none' });
  resetting.value = true;
  try {
    await http.post('/api/users/resetPassword', { username: resetUsername.value.trim() });
    uni.showToast({ title: '重置成功', icon: 'success' });
    showResetModal.value = false;
    resetUsername.value = '';
  } catch (e) {
    uni.showToast({ title: typeof e === 'string' ? e : '重置失败', icon: 'none' });
  } finally {
    resetting.value = false;
  }
};

const goChangePwd = () => {
  uni.navigateTo({ url: '/pages/mine/changePassword' });
};

const handleLogout = () => {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    confirmColor: '#FF4D4F',
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync(TOKEN_KEY);
        uni.removeStorageSync(USER_KEY);
        try { getApp().globalData?.sppSocket?.close(); getApp().globalData.sppSocket = null; } catch (e) { }
        uni.reLaunch({ url: '/pages/login/login' });
      }
    }
  });
};
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F6FA;
}

/* ===== 头部 ===== */
.header {
  background: radial-gradient(circle at top right, $primary-color, $primary-dark);
  border-radius: 0 0 60rpx 60rpx;
  padding: 0 40rpx 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-spacer {
  height: calc(var(--status-bar-height) + 80rpx);
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.avatar-text {
  font-size: 52rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.username {
  font-size: 36rpx;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 10rpx;
}

.role-tag {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.2);
  padding: 4rpx 20rpx;
  border-radius: 20rpx;
}

/* ===== 信息卡片 ===== */
.card {
  width: 650rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  margin: -30rpx auto 0;
  padding: 0 40rpx;
  box-sizing: border-box;
  box-shadow: 0 4rpx 28rpx rgba(0, 0, 0, 0.05);
  position: relative;
  z-index: 10;
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100rpx;
}

.card-divider {
  height: 1px;
  background: #F2F2F5;
}

.row-label {
  font-size: 30rpx;
  color: #666;
}

.row-value {
  font-size: 30rpx;
  color: #999;
}

/* ===== 操作按钮 ===== */
.actions {
  padding: 40rpx 50rpx;
}

.action-btn {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 36rpx 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.03);

  &.danger {
    margin-top: 60rpx;
  }

  &:active {
    background: #F8F9FA;
  }
}

.action-text {
  font-size: 32rpx;
  color: #2D3139;
  font-weight: 500;
}

.danger .action-text {
  color: #FF4D4F;
}

.action-arrow {
  font-size: 24rpx;
  color: #C0C4CC;
}

.admin-action {
  color: $primary-color !important;
}

/* ===== 弹窗 ===== */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8rpx);
}

.modal {
  width: 600rpx;
  background: #FFFFFF;
  border-radius: 32rpx;
  padding: 48rpx 40rpx 32rpx;
}

.modal-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #2D3139;
  display: block;
  text-align: center;
  margin-bottom: 36rpx;
}

.modal-input {
  width: 100%;
  height: 96rpx;
  background: #F6F7FB;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.modal-hint {
  font-size: 24rpx;
  color: #B0B5C1;
  display: block;
  margin-top: 16rpx;
  text-align: center;
}

.modal-btns {
  display: flex;
  margin-top: 32rpx;
}

.modal-btn {
  flex: 1;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 600;

  &.cancel {
    background: #F5F6FA;
    color: #666;
    margin-right: 20rpx;
  }

  &.confirm {
    background: $primary-color;
    color: #FFFFFF;
  }

  &:active {
    opacity: 0.85;
  }
}
</style>
