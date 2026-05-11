<template>
  <section v-if="viewerUrl" class="viewer-card">
    <div class="viewer-header">
      <div>
        <h2>Viewer</h2>
        <p class="viewer-copy">
          OHIF is open inside this page. You can keep browsing the portal and reopen the same study in a separate tab any time.
        </p>
      </div>
      <div class="viewer-header-actions">
        <a :href="viewerUrl" target="_blank" rel="noreferrer">Open in a new tab</a>
        <button type="button" class="secondary-action" @click="$emit('close')">
          Close Embedded Viewer
        </button>
      </div>
    </div>
    <iframe :src="viewerUrl" title="OHIF Viewer" />
  </section>
</template>

<script setup>
defineProps({
  viewerUrl: {
    type: String,
    required: true,
  },
});

defineEmits(['close']);
</script>
