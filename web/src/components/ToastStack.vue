<template>
  <TransitionGroup
    tag="div"
    class="toast-stack"
    aria-live="polite"
    aria-atomic="true"
    name="toast"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="`toast-${toast.type}`"
      role="status"
    >
      <div class="toast-copy">
        <strong>{{ toast.title }}</strong>
        <p>{{ toast.message }}</p>
      </div>
      <button
        type="button"
        class="toast-dismiss"
        :aria-label="`Dismiss ${toast.title}`"
        @click="$emit('dismiss', toast.id)"
      >
        &times;
      </button>
    </div>
  </TransitionGroup>
</template>

<script setup>
defineProps({ toasts: { type: Array, required: true } });
defineEmits(['dismiss']);
</script>