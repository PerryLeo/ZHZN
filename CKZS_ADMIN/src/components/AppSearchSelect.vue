<template>
  <div class="search-select" :class="{ 'search-select-full': fullWidth, 'search-select-compact': compact }">
    <button
      :id="id"
      ref="trigger"
      class="filter-select search-select-trigger"
      type="button"
      :aria-label="`${label}：${selectedLabel}`"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      :disabled="disabled"
      @click="toggle"
    >{{ selectedLabel }}</button>
    <Teleport to="body">
      <div v-if="open" :id="panelId" ref="panel" class="search-select-panel" @keydown.esc.stop.prevent="close(true)" @keydown.tab="handleTab">
        <input
          ref="searchInput"
          v-model="keyword"
          class="form-control search-select-input"
          type="search"
          :placeholder="searchPlaceholder"
          :aria-label="searchPlaceholder"
          @keydown.enter="selectSingleMatch"
        >
        <div class="search-select-options" role="group" :aria-label="`${label}选项`">
          <button v-if="emptyLabel" type="button" :aria-pressed="modelValue === ''" @click="selectOption('')">{{ emptyLabel }}</button>
          <button
            v-for="option in matches"
            :key="option.value"
            type="button"
            :aria-pressed="modelValue === option.value"
            @click="selectOption(option.value)"
          >{{ option.label }}</button>
          <p v-if="!matches.length" class="search-select-empty" role="status">没有匹配的选项</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

const props = defineProps({
  id: String,
  modelValue: [String, Number],
  label: { type: String, required: true },
  options: { type: Array, required: true },
  emptyLabel: String,
  searchPlaceholder: { type: String, default: '搜索选项' },
  disabled: Boolean,
  fullWidth: Boolean,
  compact: Boolean,
});
const emit = defineEmits(['update:modelValue', 'change']);
const panelId = `search-select-${useId()}`;
const trigger = ref(null);
const panel = ref(null);
const searchInput = ref(null);
const open = ref(false);
const keyword = ref('');
const selectedLabel = computed(() => (
  props.options.find(option => option.value === props.modelValue)?.label || props.emptyLabel || '请选择'
));
const matches = computed(() => {
  const search = keyword.value.trim().toLowerCase();
  return props.options.filter(option => option.label.toLowerCase().includes(search));
});

const positionPanel = () => {
  const bounds = trigger.value.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const width = Math.min(Math.max(bounds.width, 220), viewportWidth - 16);
  const left = Math.max(8, Math.min(bounds.left, viewportWidth - width - 8));
  const below = viewportHeight - bounds.bottom - 14;
  const above = bounds.top - 14;
  const openAbove = below < 300 && above > below;
  Object.assign(panel.value.style, {
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${Math.min(300, openAbove ? above : below)}px`,
    top: openAbove ? 'auto' : `${bounds.bottom + 6}px`,
    bottom: openAbove ? `${viewportHeight - bounds.top + 6}px` : 'auto',
  });
};
const closeOnOutsidePress = (event) => {
  if (!trigger.value.contains(event.target) && !panel.value.contains(event.target)) close();
};
const removeListeners = () => {
  window.removeEventListener('resize', positionPanel);
  window.removeEventListener('scroll', positionPanel, true);
  document.removeEventListener('pointerdown', closeOnOutsidePress, true);
};
const close = (restoreFocus = false) => {
  open.value = false;
  removeListeners();
  if (restoreFocus) trigger.value.focus();
};
const toggle = async () => {
  if (open.value) {
    close(true);
    return;
  }
  keyword.value = '';
  open.value = true;
  await nextTick();
  if (!panel.value) return;
  positionPanel();
  searchInput.value.focus({ preventScroll: true });
  window.addEventListener('resize', positionPanel);
  window.addEventListener('scroll', positionPanel, true);
  document.addEventListener('pointerdown', closeOnOutsidePress, true);
};
const handleTab = (event) => {
  if (event.shiftKey && event.target === searchInput.value) {
    event.preventDefault();
    close(true);
  } else if (!event.shiftKey && event.target === (panel.value.querySelector('button:last-of-type') || searchInput.value)) {
    close(true);
  }
};
const selectOption = (value) => {
  close(true);
  if (props.modelValue === value) return;
  emit('update:modelValue', value);
  emit('change', value);
};
const selectSingleMatch = (event) => {
  if (event.isComposing) return;
  event.preventDefault();
  if (!event.repeat && matches.value.length === 1) selectOption(matches.value[0].value);
};
watch(() => props.disabled, (disabled) => {
  if (disabled && open.value) close();
});
onBeforeUnmount(removeListeners);
</script>

<style scoped>
.search-select { width: fit-content; min-width: 0; max-width: 100%; }
.search-select-full { width: 100%; }
.search-select-trigger { width: 100%; min-width: 0; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.search-select-trigger:disabled { opacity: .55; cursor: not-allowed; }
.search-select-compact .search-select-trigger { height: 32px; padding-right: 30px; background-position: right 8px center; }
.search-select-panel { position: fixed; z-index: 150; display: flex; flex-direction: column; gap: 4px; padding: 8px; overflow: auto; border: 1px solid var(--line); border-radius: 10px; background: #fff; color: var(--ink); box-shadow: var(--shadow); font-size: 13px; }
.search-select-input { flex: none; height: 36px; }
.search-select-options { min-height: 0; overflow-y: auto; }
.search-select-options button { display: block; width: 100%; padding: 8px; border: 0; border-radius: 6px; background: #fff; color: inherit; text-align: left; overflow-wrap: anywhere; }
.search-select-options button:hover, .search-select-options button[aria-pressed="true"] { background: var(--primary-soft); color: var(--primary); }
.search-select-options button:focus-visible { outline-offset: -2px; }
.search-select-empty { margin: 0; padding: 8px; color: var(--muted); }
</style>
