<template>
  <div v-if="loading" class="loading">数据加载中...</div>
  <template v-else>
    <section class="stat-grid">
      <StatCard label="设备总数" :value="data.totals.devices" note="平台全部硬件资产" icon="device" color="#3157e5" soft="#edf1ff" />
      <StatCard label="在线设备" :value="data.totals.online" :note="`在线率 ${onlineRate}%`" icon="online" color="#17a673" soft="#e9f8f2" />
      <StatCard label="已绑定设备" :value="data.totals.bound" :note="`${data.totals.unbound} 台待绑定`" icon="bound" color="#f29b38" soft="#fff5e8" />
      <StatCard label="平台用户" :value="data.totals.users" note="APP 与 PC 共用用户" icon="users" color="#8957d9" soft="#f4edff" />
    </section>
    <section class="content-grid">
      <div class="panel">
        <div class="panel-header"><div><h2>设备类型分布</h2><p>平台全部硬件资产构成</p></div><RouterLink class="text-btn link-btn" to="/devices">查看设备</RouterLink></div>
        <div class="panel-body device-bars">
          <div v-for="item in data.deviceTypes" :key="item.type">
            <div class="bar-meta"><span>{{ typeLabel(item.type) }}</span><span>{{ item.count }} 台</span></div>
            <div class="bar-track"><div class="bar-fill" :style="{ width: `${Math.max(item.count / maxTypeCount * 100, 5)}%` }"></div></div>
          </div>
          <div v-if="!data.deviceTypes.length" class="empty-state">暂无设备类型数据</div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h2>最近更新设备</h2><p>按设备更新时间排序</p></div></div>
        <div class="panel-body activity-list">
          <div v-for="item in data.recentDevices" :key="item.id" class="activity-item">
            <i class="status-dot" :class="{ online: item.online === 1 }"></i>
            <div class="activity-info"><strong>{{ item.remarkName || '--' }}</strong><span>{{ item.owner?.username || '未绑定用户' }}</span></div>
            <span class="activity-time">{{ formatTime(item.updatedAt) }}</span>
          </div>
          <div v-if="!data.recentDevices.length" class="empty-state">暂无设备数据</div>
        </div>
      </div>
    </section>
  </template>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue';
import { api } from '../services/api.js';
import { formatTime, typeLabel } from '../utils/format.js';
import { showToast } from '../utils/toast.js';

const loading = ref(true);
const data = reactive({
  totals: { users: 0, devices: 0, bound: 0, unbound: 0, online: 0, offline: 0 },
  deviceTypes: [],
  recentDevices: [],
});
const onlineRate = computed(() => data.totals.devices ? Math.round(data.totals.online / data.totals.devices * 100) : 0);
const maxTypeCount = computed(() => Math.max(...data.deviceTypes.map(item => item.count), 1));

const iconNodes = {
  device: () => [
    h('rect', { x: 4, y: 3, width: 16, height: 18, rx: 2 }),
    h('path', { d: 'M8 7h8M8 11h8' }),
    h('circle', { cx: 8, cy: 16.5, r: 1, fill: 'currentColor', stroke: 'none' }),
    h('path', { d: 'M12 16.5h4' }),
  ],
  online: () => [
    h('path', { d: 'M5 9.5a10.6 10.6 0 0 1 14 0' }),
    h('path', { d: 'M8 13a6.2 6.2 0 0 1 8 0' }),
    h('path', { d: 'M10.8 16.4a2.2 2.2 0 0 1 2.4 0' }),
    h('circle', { cx: 12, cy: 19, r: 1.2, fill: 'currentColor', stroke: 'none' }),
  ],
  bound: () => [
    h('path', { d: 'm9.5 14.5-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0' }),
    h('path', { d: 'm14.5 9.5 1-1a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0' }),
    h('path', { d: 'm8.5 15.5 7-7' }),
  ],
  users: () => [
    h('circle', { cx: 9, cy: 8, r: 3 }),
    h('path', { d: 'M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20' }),
    h('path', { d: 'M15.5 5.3a3 3 0 0 1 0 5.4M17 14a4.5 4.5 0 0 1 3.5 4.4V20' }),
  ],
};

const StatIcon = defineComponent({
  props: ['name'],
  setup(props) {
    return () => h('svg', {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.8,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    }, (iconNodes[props.name] || iconNodes.device)());
  },
});

const StatCard = defineComponent({
  props: ['label', 'value', 'note', 'icon', 'color', 'soft'],
  setup(props) {
    return () => h('div', { class: 'stat-card', style: { '--stat-color': props.color, '--stat-soft': props.soft } }, [
      h('div', { class: 'stat-head' }, [
        h('span', props.label),
        h('span', { class: 'stat-icon' }, [h(StatIcon, { name: props.icon })]),
      ]),
      h('div', { class: 'stat-value' }, props.value),
      h('div', { class: 'stat-note' }, props.note),
    ]);
  },
});

onMounted(async () => {
  try { Object.assign(data, await api.get('/api/admin/dashboard')); }
  catch (error) { showToast(error.message, 'error'); }
  finally { loading.value = false; }
});
</script>
