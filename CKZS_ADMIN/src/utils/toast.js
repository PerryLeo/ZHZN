import { reactive } from 'vue';

export const toasts = reactive([]);

export const showToast = (message, type = 'success') => {
  const id = `${Date.now()}-${Math.random()}`;
  toasts.push({ id, message, type });
  window.setTimeout(() => {
    const index = toasts.findIndex(item => item.id === id);
    if (index >= 0) toasts.splice(index, 1);
  }, 3000);
};
