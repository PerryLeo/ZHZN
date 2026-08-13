<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-mask" @click.self="$emit('update:modelValue', false)">
        <div class="modal">
          <div class="modal-header">
            <h3>{{ title }}</h3>
            <button class="modal-close" type="button" aria-label="关闭弹窗" @click="$emit('update:modelValue', false)"><AppIcon name="close" :size="18" /></button>
          </div>
          <form @submit.prevent="$emit('confirm')">
            <div class="modal-body"><slot /></div>
            <div class="modal-footer" :class="{ single: !showCancel }">
              <button v-if="showCancel" class="secondary-btn" type="button" @click="$emit('update:modelValue', false)">取消</button>
              <button :class="danger ? 'danger-btn' : 'primary-btn'" type="submit" :disabled="loading">
                {{ loading ? '处理中...' : confirmText }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import AppIcon from './AppIcon.vue';

defineProps({
  modelValue: Boolean,
  title: { type: String, required: true },
  confirmText: { type: String, default: '保存' },
  loading: Boolean,
  danger: Boolean,
  showCancel: { type: Boolean, default: true },
});

defineEmits(['update:modelValue', 'confirm']);
</script>
