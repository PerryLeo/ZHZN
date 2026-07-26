<template>
  <view class="page">
    <!-- 头部 -->
    <view class="header">
      <view class="header-spacer"></view>
      <view class="header-row">
        <view class="back-btn" @click="goBack">
          <text class="iconfont icon-arrow-left"></text>
        </view>
        <text class="header-title">修改密码</text>
      </view>
    </view>

    <!-- 表单 -->
    <view class="form">
      <view class="field">
        <text class="label">旧密码</text>
        <input class="input" v-model="oldPwd" type="password" placeholder="请输入旧密码" placeholder-style="color:#C0C4CC;" />
      </view>
      <view class="field">
        <text class="label">新密码</text>
        <input class="input" v-model="newPwd" type="password" placeholder="至少6位" placeholder-style="color:#C0C4CC;" />
      </view>
      <view class="field">
        <text class="label">确认密码</text>
        <input class="input" v-model="confirmPwd" type="password" placeholder="再次输入新密码"
          placeholder-style="color:#C0C4CC;" />
      </view>
    </view>

    <view class="footer">
      <button class="submit-btn" :disabled="submitting" @click="handleSubmit">
        {{ submitting ? '提交中...' : '确认修改' }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import http from '@/common/request.js';
import { TOKEN_KEY, USER_KEY } from '@/common/config.js';

const oldPwd = ref('');
const newPwd = ref('');
const confirmPwd = ref('');
const submitting = ref(false);

const handleSubmit = async () => {
  if (!oldPwd.value || !newPwd.value || !confirmPwd.value) {
    return uni.showToast({ title: '请填写完整', icon: 'none' });
  }
  if (newPwd.value.length < 6) {
    return uni.showToast({ title: '新密码至少6位', icon: 'none' });
  }
  if (newPwd.value !== confirmPwd.value) {
    return uni.showToast({ title: '两次输入不一致', icon: 'none' });
  }

  submitting.value = true;
  try {
    await http.post('/api/users/changePassword', {
      oldPassword: oldPwd.value,
      newPassword: newPwd.value,
    });
    uni.showToast({ title: '修改成功', icon: 'success' });
    uni.removeStorageSync(TOKEN_KEY);
    uni.removeStorageSync(USER_KEY);
    setTimeout(() => uni.reLaunch({ url: '/pages/login/login' }), 1000);
  } catch (e) {
    uni.showToast({ title: typeof e === 'string' ? e : '修改失败', icon: 'none' });
  } finally {
    submitting.value = false;
  }
};

const goBack = () => uni.navigateBack();
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #F5F6FA;
}

.header {
  background: radial-gradient(circle at top right, $primary-color, $primary-dark);
  border-radius: 0 0 60rpx 60rpx;
  padding: 0 30rpx 60rpx;
}

.header-spacer {
  height: calc(var(--status-bar-height) + 20rpx);
}

.header-row {
  display: flex;
  align-items: center;
  position: relative;
}

.back-btn {
  width: 70rpx;
  height: 70rpx;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 32rpx;
}

.header-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
}

.form {
  margin: -30rpx 30rpx 0;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 16rpx 40rpx;
  box-shadow: 0 4rpx 28rpx rgba(0, 0, 0, 0.05);
  position: relative;
  z-index: 10;
}

.field {
  height: 110rpx;
  display: flex;
  align-items: center;
}

.field:not(:last-child) {
  border-bottom: 1px solid #F2F2F5;
}

.label {
  font-size: 30rpx;
  color: #2D3139;
  font-weight: 500;
  width: 140rpx;
}

.input {
  flex: 1;
  font-size: 30rpx;
  color: #333;
  text-align: right;
}

.footer {
  padding: 60rpx 30rpx;
}

.submit-btn {
  width: 100%;
  height: 104rpx;
  line-height: 104rpx;
  padding: 0;
  text-align: center;
  background: linear-gradient(135deg, $primary-color, $primary-dark);
  color: #FFFFFF;
  border-radius: 52rpx;
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
  border: none;
  box-shadow: 0 12rpx 32rpx rgba($primary-color, 0.3);

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.6;
  }

  &:active:not([disabled]) {
    opacity: 0.9;
    transform: scale(0.98);
  }
}
</style>
