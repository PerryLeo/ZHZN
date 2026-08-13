<template>
  <div class="login-view">
    <section class="login-brand">
      <div class="brand-content">
        <p class="eyebrow hero-eyebrow">INTELLIGENT DEVICE CLOUD</p>
        <h1>让每一台设备<br>始终清晰可控</h1>
        <p class="brand-desc">统一管理设备资产、用户绑定与远程指令，实时掌握硬件运行状态。</p>
        <div class="brand-points"><span>设备资产统一管理</span><span>远程指令安全下发</span><span>APP 数据实时同步</span></div>
      </div>
      <div class="orb orb-one"></div><div class="orb orb-two"></div>
    </section>
    <section class="login-panel">
      <form class="login-card" @submit.prevent="login">
        <div class="mobile-brand">智控云</div>
        <p class="eyebrow dark">ADMIN CONSOLE</p>
        <h2>欢迎回来</h2>
        <p class="login-hint">使用管理员账号登录设备管理平台</p>
        <label class="field-label" for="username">管理员账号</label>
        <div class="input-wrap"><span class="input-icon"><AppIcon name="user" :size="18" /></span><input id="username" v-model.trim="form.username" autocomplete="username" placeholder="请输入账号" required></div>
        <label class="field-label" for="password">密码</label>
        <div class="input-wrap"><span class="input-icon"><AppIcon name="lock" :size="18" /></span><input id="password" v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="请输入密码" required><button class="ghost-icon" type="button" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button></div>
        <p class="form-error" role="alert">{{ errorMessage }}</p>
        <button class="primary-btn login-btn" type="submit" :disabled="loading">{{ loading ? '正在验证...' : '登录管理平台' }}</button>
        <p class="security-tip">登录即表示您已获授权访问本系统</p>
      </form>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../services/api.js';
import { clearSession, saveSession } from '../services/auth.js';
import AppIcon from '../components/AppIcon.vue';

const route = useRoute();
const router = useRouter();
const form = reactive({ username: '', password: '' });
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');

const login = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await api.post('/api/users/login', form);
    if (data.user?.role !== 'admin') throw new Error('当前账号不是管理员，无权访问管理平台');
    saveSession(data);
    await router.replace(String(route.query.redirect || '/dashboard'));
  } catch (error) {
    clearSession();
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
};
</script>
