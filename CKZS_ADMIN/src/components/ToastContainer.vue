<template>
  <div class="toast-root" aria-live="polite">
    <TransitionGroup name="toast-list">
      <div v-for="item in toasts" :key="item.id" class="toast" :class="item.type">
        {{ item.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { toasts } from '../utils/toast.js';
</script>
