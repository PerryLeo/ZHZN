import { createRouter, createWebHistory } from 'vue-router';
import { isAdmin } from '../services/auth.js';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('../layouts/AdminLayout.vue'),
      children: [
        { path: '', redirect: '/devices' },
        { path: 'devices', name: 'devices', component: () => import('../views/DevicesView.vue'), meta: { title: '设备管理', eyebrow: 'DEVICE ASSETS' } },
        { path: 'devices/detail/:deviceCode', name: 'device-detail', component: () => import('../views/DeviceDetailView.vue'), meta: { title: '设备详情', eyebrow: 'DEVICE DETAIL' } },
        { path: 'users', name: 'users', component: () => import('../views/UsersView.vue'), meta: { title: '用户管理', eyebrow: 'USER ACCOUNTS' } },
        { path: 'commands', name: 'commands', component: () => import('../views/CommandsView.vue'), meta: { title: '指令控制', eyebrow: 'REMOTE COMMAND' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  if (!to.meta.public && !isAdmin()) return { name: 'login', query: { redirect: to.fullPath } };
  if (to.name === 'login' && isAdmin()) return { name: 'devices' };
  return true;
});

export default router;
