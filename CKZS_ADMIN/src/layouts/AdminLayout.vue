<template>
  <div class="app-view">
    <aside class="sidebar">
      <div class="sidebar-brand">智控云</div>
      <nav class="main-nav">
        <RouterLink v-for="item in menu" :key="item.name" class="nav-item" :to="{ name: item.name }">
          <span class="nav-icon"><AppIcon :name="item.icon" :size="20" /></span>{{ item.label }}
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <div class="service-state"><i></i><span>服务运行正常</span></div>
        <button class="logout-btn" type="button" @click="logout"><AppIcon name="logout" :size="19" />退出登录</button>
      </div>
    </aside>

    <main class="workspace" :class="{ 'detail-workspace': route.name === 'device-detail' }">
      <header class="topbar">
        <div>
          <p class="eyebrow dark">{{ route.meta.eyebrow }}</p>
          <h1>{{ route.meta.title }}</h1>
        </div>
        <div class="top-actions">
          <div class="admin-profile">
            <div class="avatar">{{ avatar }}</div>
            <div><strong>{{ user?.username }}</strong><span>系统管理员</span></div>
          </div>
        </div>
      </header>
      <div class="page-content">
        <RouterView :key="route.fullPath" />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clearSession, getUser } from '../services/auth.js';
import { showToast } from '../utils/toast.js';
import AppIcon from '../components/AppIcon.vue';

const route = useRoute();
const router = useRouter();
const user = getUser();
const avatar = computed(() => user?.username?.slice(0, 1).toUpperCase() || 'A');
const menu = [
  { name: 'devices', label: '设备管理', icon: 'device' },
  { name: 'users', label: '用户管理', icon: 'users' },
  { name: 'ota', label: 'OTA升级', icon: 'ota' },
  { name: 'app-versions', label: 'App版本管理', icon: 'ota' },
  { name: 'commands', label: '指令控制', icon: 'command' },
];

const logout = async () => {
  clearSession();
  await router.replace({ name: 'login' });
  showToast('已安全退出');
};
</script>

<style scoped>
@media (min-width: 1101px) {
  .detail-workspace:has(.detail-tab-status) .page-content { padding: 20px 24px; }
}
</style>
