<template>
  <div class="pagination">
    <span>第 {{ page }} / {{ Math.max(totalPages, 1) }} 页，共 {{ total }} 条</span>
    <button class="page-btn" type="button" aria-label="上一页" :disabled="page <= 1" @click="$emit('change', page - 1)"><AppIcon name="chevron-left" :size="16" /></button>
    <button class="page-btn" type="button" aria-label="下一页" :disabled="page >= totalPages" @click="$emit('change', page + 1)"><AppIcon name="chevron-right" :size="16" /></button>
  </div>
</template>

<script setup>
import AppIcon from './AppIcon.vue';

defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
  totalPages: { type: Number, required: true },
});

defineEmits(['change']);
</script>
