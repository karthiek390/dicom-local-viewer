import { ref } from 'vue';

const TOAST_DURATION_MS = 3200;

export function useNotifications() {
  const toasts = ref([]);
  const toastTimeoutHandles = new Map();
  let nextToastId = 0;

  function dismissToast(toastId) {
    const timeoutHandle = toastTimeoutHandles.get(toastId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      toastTimeoutHandles.delete(toastId);
    }

    toasts.value = toasts.value.filter((toast) => toast.id !== toastId);
  }

  function showToast(message, type = 'info', title) {
    if (!message) {
      return;
    }

    const toastId = nextToastId += 1;
    const normalizedType = ['success', 'error', 'info'].includes(type) ? type : 'info';
    const toast = {
      id: toastId,
      type: normalizedType,
      title: title || (
        normalizedType === 'success'
          ? 'Success'
          : normalizedType === 'error'
            ? 'Action failed'
            : 'Notice'
      ),
      message,
    };

    toasts.value = [...toasts.value.slice(-2), toast];

    const timeoutHandle = window.setTimeout(() => {
      dismissToast(toastId);
    }, TOAST_DURATION_MS);
    toastTimeoutHandles.set(toastId, timeoutHandle);
  }

  function showActionSuccess(action, message) {
    showToast(message, 'success', `${action} Complete`);
  }

  function showActionError(action, message) {
    showToast(message, 'error', `${action} Failed`);
  }

  function showActionInfo(action, message) {
    showToast(message, 'info', `${action} Update`);
  }

  function clearToasts() {
    toastTimeoutHandles.forEach((timeoutHandle) => clearTimeout(timeoutHandle));
    toastTimeoutHandles.clear();
    toasts.value = [];
  }

  return {
    toasts,
    dismissToast,
    showToast,
    showActionSuccess,
    showActionError,
    showActionInfo,
    clearToasts,
  };
}
