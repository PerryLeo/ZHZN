<template>
  <view class="page">
    <!-- 背景装饰 -->
    <view class="bg-orb bg-orb-1"></view>
    <view class="bg-orb bg-orb-2"></view>
    <view class="bg-ring"></view>

    <!-- 中心插图区 -->
    <view class="visual">
      <!-- 外层涟漪 -->
      <view class="ripple r1"></view>
      <view class="ripple r2"></view>
      <!-- 几何 Logo -->
      <view class="logo-mark">
        <view class="bar bar-1"></view>
        <view class="bar bar-2"></view>
        <view class="bar bar-3"></view>
        <view class="dot-core"></view>
      </view>
    </view>

    <!-- 文字区 -->
    <view class="text-area">
      <text class="title">智能喂虾机器</text>
      <text class="subtitle">Smart Shrimp Feeder</text>
    </view>

    <!-- 底部加载条 -->
    <view class="loader">
      <view class="loader-dot"></view>
      <view class="loader-dot"></view>
      <view class="loader-dot"></view>
    </view>
  </view>
</template>

<script setup>
import { onMounted } from 'vue';
import { API_BASE_URL, TOKEN_KEY, USER_KEY } from '@/common/config.js';

const go = (url) => uni.reLaunch({ url });

const checkAndGo = () => {
  const token = uni.getStorageSync(TOKEN_KEY);

  if (!token) {
    go('/pages/login/login');
    return;
  }

  uni.request({
    url: API_BASE_URL + '/api/users/profile',
    method: 'GET',
    header: { 'Authorization': `Bearer ${token}` },
    success: (res) => {
      if (res.data.code === 0) {
        uni.setStorageSync(USER_KEY, JSON.stringify(res.data.data));
        go('/pages/home/index');
      } else {
        uni.removeStorageSync(TOKEN_KEY);
        uni.removeStorageSync(USER_KEY);
        go('/pages/login/login');
      }
    },
    fail: () => {
      go('/pages/home/index');
    },
  });
};

onMounted(() => {
  try { plus.navigator.closeSplashscreen(); } catch (e) { }
  setTimeout(checkAndGo, 100);
});
</script>

<style lang="scss" scoped>
.page {
  height: 100vh;
  width: 100%;
  background: radial-gradient(ellipse at 50% 30%, #FFB866 0%, #FF8C00 40%, #E07000 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

/* ===== 背景装饰 ===== */
.bg-orb {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  pointer-events: none;
}

.bg-orb-1 {
  width: 500rpx;
  height: 500rpx;
  top: -160rpx;
  left: -160rpx;
}

.bg-orb-2 {
  width: 360rpx;
  height: 360rpx;
  bottom: 180rpx;
  right: -120rpx;
}

.bg-ring {
  position: absolute;
  width: 600rpx;
  height: 600rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 255, 255, 0.08);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -55%);
  pointer-events: none;
}

/* ===== 中心视觉 ===== */
.visual {
  width: 240rpx;
  height: 240rpx;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 56rpx;
}

/* 涟漪 */
.ripple {
  position: absolute;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 255, 255, 0.25);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.r1 {
  width: 280rpx;
  height: 280rpx;
  animation: rippleOut 2s ease-out infinite;
}

.r2 {
  width: 280rpx;
  height: 280rpx;
  animation: rippleOut 2s ease-out 0.7s infinite;
}

@keyframes rippleOut {
  0% {
    width: 180rpx;
    height: 180rpx;
    opacity: 0.5;
  }

  100% {
    width: 320rpx;
    height: 320rpx;
    opacity: 0;
  }
}

/* 几何 Logo — 三弧 + 圆心 */
.logo-mark {
  width: 200rpx;
  height: 200rpx;
  position: relative;
  z-index: 2;
}

.bar {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  border: 6rpx solid transparent;
}

.bar-1 {
  width: 180rpx;
  height: 180rpx;
  margin: -90rpx 0 0 -90rpx;
  border-top-color: rgba(255, 255, 255, 0.9);
  border-right-color: rgba(255, 255, 255, 0.6);
  animation: spinBar 3s linear infinite;
}

.bar-2 {
  width: 130rpx;
  height: 130rpx;
  margin: -65rpx 0 0 -65rpx;
  border-bottom-color: rgba(255, 255, 255, 0.7);
  border-left-color: rgba(255, 255, 255, 0.4);
  animation: spinBar 2.4s linear reverse infinite;
}

.bar-3 {
  width: 80rpx;
  height: 80rpx;
  margin: -40rpx 0 0 -40rpx;
  border-top-color: rgba(255, 255, 255, 0.5);
  animation: spinBar 1.8s linear infinite;
}

@keyframes spinBar {
  to {
    transform: rotate(360deg);
  }
}

.dot-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24rpx;
  height: 24rpx;
  margin: -12rpx 0 0 -12rpx;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 0 20rpx rgba(255, 255, 255, 0.6);
}

/* ===== 文字 ===== */
.text-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.title {
  font-size: 48rpx;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: 8rpx;
  margin-bottom: 14rpx;
}

.subtitle {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.65);
  letter-spacing: 6rpx;
}

/* ===== 加载指示器 ===== */
.loader {
  display: flex;
}

.loader-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  animation: dotBounce 1.4s ease-in-out infinite;

  & + .loader-dot {
    margin-left: 16rpx;
  }

  &:nth-child(2) {
    animation-delay: 0.2s;
  }

  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

@keyframes dotBounce {

  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }

  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
