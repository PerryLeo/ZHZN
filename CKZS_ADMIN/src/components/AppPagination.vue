<template>
  <nav class="pagination" aria-label="分页">
    <span>第 {{ page }} / {{ lastPage }} 页，共 {{ total }} 条</span>
    <AppSearchSelect
      label="每页条数"
      :model-value="pageSize"
      :options="pageSizeOptions"
      :disabled="disabled"
      compact
      @change="emit('page-size-change', $event)"
    />
    <button class="page-btn" type="button" aria-label="上一页" :disabled="disabled || page <= 1" @click="changePage(page - 1)"><AppIcon name="chevron-left" :size="16" /></button>
    <div class="page-numbers" role="group" aria-label="页码">
      <template v-for="item in pageItems" :key="item">
        <span v-if="typeof item === 'string'" class="page-gap" aria-hidden="true">…</span>
        <button
          v-else
          class="page-btn page-number"
          type="button"
          :aria-label="`第 ${item} 页`"
          :aria-current="item === page ? 'page' : undefined"
          :disabled="disabled"
          @click="changePage(item)"
        >{{ item }}</button>
      </template>
    </div>
    <button class="page-btn" type="button" aria-label="下一页" :disabled="disabled || page >= lastPage" @click="changePage(page + 1)"><AppIcon name="chevron-right" :size="16" /></button>
    <form class="page-jump" @submit.prevent="jump">
      <input v-model.number="targetPage" type="number" min="1" :max="lastPage" required aria-label="目标页码" :disabled="jumpDisabled">
      <button class="page-btn" type="submit" :disabled="jumpDisabled">跳转</button>
    </form>
  </nav>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import AppSearchSelect from './AppSearchSelect.vue';

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  pageSize: { type: Number, default: 10 },
  disabled: Boolean,
});

const emit = defineEmits(['change', 'page-size-change']);
const pageSizeOptions = [10, 20, 50].map(size => ({ value: size, label: `${size} 条/页` }));
const lastPage = computed(() => Math.max(props.totalPages, 1));
const jumpDisabled = computed(() => props.disabled || lastPage.value <= 1);
const pageItems = computed(() => {
  const page = props.page;
  const totalPages = lastPage.value;
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'after', totalPages];
  if (page >= totalPages - 3) {
    return [1, 'before', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'before', page - 1, page, page + 1, 'after', totalPages];
});

const targetPage = ref(props.page);
watch(() => [props.page, props.totalPages, props.pageSize], () => {
  targetPage.value = props.page;
});
const changePage = (page) => {
  if (!props.disabled && Number.isInteger(page) && page >= 1 && page <= props.totalPages && page !== props.page) {
    emit('change', page);
  }
};
const jump = () => changePage(targetPage.value);
</script>

<style scoped>
.pagination { flex-wrap: wrap; }
.page-numbers { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.page-number { width: auto; min-width: 34px; padding: 0 6px; }
.page-number[aria-current="page"] { border-color: var(--primary); color: #fff; background: var(--primary); }
.page-gap { width: 20px; text-align: center; }
.page-jump { display: flex; align-items: center; gap: 6px; }
.page-jump input { width: 64px; height: 32px; padding: 0 8px; border: 1px solid var(--line); border-radius: 8px; }
.page-jump .page-btn { width: auto; padding: 0 10px; }
</style>
