<template>
  <view class="page">
    <!-- 背景层 -->
    <view class="bg-layer">
      <view class="wave wave-1"></view>
      <view class="wave wave-2"></view>
      <view class="blob blob-1"></view>
      <view class="blob blob-2"></view>
    </view>

    <!-- 品牌区 -->
    <view class="brand">
      <text class="brand-name">创建账号</text>
      <text class="brand-tagline">Join Smart Shrimp Feeder</text>
    </view>

    <!-- 毛玻璃卡片 -->
    <view class="glass-card">
      <text class="card-heading">注册</text>

      <view class="field">
        <text class="field-hint">用户名</text>
        <input
          class="field-input"
          v-model="username"
          placeholder="请输入用户名"
          placeholder-style="color:#BBB;font-size:30rpx;"
        />
      </view>

      <view class="field">
        <text class="field-hint">密码</text>
        <input
          class="field-input"
          v-model="password"
          type="password"
          placeholder="至少6位密码"
          placeholder-style="color:#BBB;font-size:30rpx;"
        />
      </view>

      <view class="field">
        <text class="field-hint">确认密码</text>
        <input
          class="field-input"
          v-model="confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          placeholder-style="color:#BBB;font-size:30rpx;"
        />
      </view>

      <button class="submit" :disabled="loading" @click="handleRegister">
        {{ loading ? '注册中...' : '注  册' }}
      </button>

      <text class="switch" @click="goBack">已有账号？<text class="em">返回登录</text></text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import http from '@/common/request.js';
import { TOKEN_KEY, USER_KEY, SAVED_USERNAME, SAVED_PASSWORD } from '@/common/config.js';

const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);

const handleRegister = async () => {
  const u = username.value.trim();
  const p = password.value;
  const c = confirmPassword.value;

  if (!u || !p) return uni.showToast({ title: '请输入账号和密码', icon: 'none' });
  if (p.length < 6) return uni.showToast({ title: '密码长度不能少于6位', icon: 'none' });
  if (p !== c) return uni.showToast({ title: '两次密码输入不一致', icon: 'none' });

  loading.value = true;
  try {
    const data = await http.post('/api/users/register', { username: u, password: p });
    uni.setStorageSync(TOKEN_KEY, data.token);
    uni.setStorageSync(USER_KEY, JSON.stringify(data.user));
    // 记住账号密码
    uni.setStorageSync(SAVED_USERNAME, u);
    uni.setStorageSync(SAVED_PASSWORD, p);
    uni.showToast({ title: '注册成功', icon: 'success' });
    setTimeout(() => uni.reLaunch({ url: '/pages/home/index' }), 500);
  } catch (err) {
    uni.showToast({ title: typeof err === 'string' ? err : '注册失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const goBack = () => uni.navigateBack();
</script>

<style lang="scss" scoped>
.page {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(165deg, #FFF3E6 0%, #FDE8D0 30%, #F5E0C8 60%, #EDD5BE 100%);
}

.bg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.wave {
  position: absolute;
  border-radius: 50%;
}

.wave-1 {
  width: 700rpx;
  height: 700rpx;
  background: radial-gradient(circle, rgba($primary-color, 0.12) 0%, transparent 70%);
  top: -200rpx;
  right: -180rpx;
}

.wave-2 {
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba($primary-color, 0.10) 0%, transparent 70%);
  bottom: 120rpx;
  left: -160rpx;
}

.blob {
  position: absolute;
  border-radius: 50%;
}

.blob-1 {
  width: 36rpx;
  height: 36rpx;
  background: rgba($primary-color, 0.18);
  top: 35%;
  left: 12%;
}

.blob-2 {
  width: 52rpx;
  height: 52rpx;
  background: rgba($primary-color, 0.12);
  bottom: 18%;
  right: 15%;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 50rpx;
  position: relative;
  z-index: 2;
}

.brand-name {
  font-size: 46rpx;
  font-weight: 800;
  color: #3D2E1C;
  letter-spacing: 6rpx;
}

.brand-tagline {
  font-size: 22rpx;
  color: #B8A089;
  letter-spacing: 4rpx;
  text-transform: uppercase;
  margin-top: 10rpx;
}

.glass-card {
  width: 640rpx;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(30rpx);
  -webkit-backdrop-filter: blur(30rpx);
  border-radius: 36rpx;
  padding: 48rpx 44rpx 40rpx;
  box-sizing: border-box;
  box-shadow:
    0 8rpx 40rpx rgba(0, 0, 0, 0.06),
    0 2rpx 8rpx rgba(0, 0, 0, 0.03),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.6);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  position: relative;
  z-index: 2;
}

.card-heading {
  font-size: 40rpx;
  font-weight: 700;
  color: #2D2012;
  display: block;
  margin-bottom: 44rpx;
}

.field {
  margin-bottom: 30rpx;
}

.field-hint {
  font-size: 24rpx;
  color: #B8A089;
  margin-bottom: 14rpx;
  display: block;
  letter-spacing: 2rpx;
}

.field-input {
  width: 100%;
  height: 96rpx;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 18rpx;
  padding: 0 28rpx;
  font-size: 30rpx;
  color: #3D2E1C;
  box-sizing: border-box;
  border: 1rpx solid rgba(0, 0, 0, 0.04);
  transition: all 0.25s;

  &:focus {
    background: rgba(255, 255, 255, 0.9);
    border-color: rgba($primary-color, 0.3);
    box-shadow: 0 0 0 6rpx rgba($primary-color, 0.08);
  }
}

.submit {
  width: 100%;
  height: 104rpx;
  line-height: 104rpx;
  padding: 0;
  background: linear-gradient(135deg, #FF8C00, #E07800);
  color: #FFFFFF;
  border-radius: 52rpx;
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 8rpx;
  border: none;
  margin-top: 50rpx;
  margin-bottom: 36rpx;
  box-shadow: 0 14rpx 34rpx rgba(200, 100, 0, 0.28);
  text-align: center;

  &::after { border: none; }
  &[disabled] { opacity: 0.55; }
  &:active:not([disabled]) { opacity: 0.9; transform: scale(0.985); }
}

.switch {
  font-size: 26rpx;
  color: #B8A089;
  display: block;
  text-align: center;

  .em {
    color: $primary-color;
    font-weight: 600;
  }
}
</style>
