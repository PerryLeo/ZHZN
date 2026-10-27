<template>
  <button v-bind="$attrs" class="secondary-btn" type="button" :disabled="!text || copying" @click="copyResponse">
    {{ copying ? '复制中...' : '复制回执' }}
  </button>
  <AppModal v-model="manualVisible" title="手动复制回执" confirm-text="关闭" :show-cancel="false" @confirm="manualVisible = false">
    <p class="copy-help">浏览器未允许自动复制。请选中下方内容后按 Ctrl+C / ⌘C，手机端可长按复制。</p>
    <textarea ref="manualInput" class="form-control manual-copy-content" :value="manualText" readonly aria-label="待复制的回执内容" @keydown.esc="manualVisible = false"></textarea>
    <button class="secondary-btn" type="button" @click="selectText">全选内容</button>
  </AppModal>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import AppModal from './AppModal.vue';
import { copyText } from '../utils/clipboard.js';
import { showToast } from '../utils/toast.js';

defineOptions({ inheritAttrs: false });

const props = defineProps({ text: { type: String, default: '' } });
const copying = ref(false);
const manualVisible = ref(false);
const manualText = ref('');
const manualInput = ref(null);

const selectText = () => {
  manualInput.value?.focus({ preventScroll: true });
  manualInput.value?.select();
};

watch(manualVisible, async (visible) => {
  if (!visible) {
    manualText.value = '';
    return;
  }
  await nextTick();
  selectText();
});

const copyResponse = async () => {
  if (!props.text || copying.value) return;
  const text = props.text;
  copying.value = true;
  try {
    await copyText(text);
    showToast('回执内容已复制');
  } catch {
    manualText.value = text;
    manualVisible.value = true;
  } finally {
    copying.value = false;
  }
};
</script>

<style scoped>
.copy-help {
  margin: 0 0 12px;
  line-height: 1.6;
}
.manual-copy-content {
  display: block;
  width: 100%;
  min-height: 240px;
  margin-bottom: 12px;
  resize: vertical;
  font-family: monospace;
}
</style>
