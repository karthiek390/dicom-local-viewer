<template>
  <section class="hero-card">
    <p class="eyebrow">Dataset Detail</p>
    <div class="selection-card-header">
      <div>
        <h1>{{ dataset?.label || 'Dataset detail unavailable' }}</h1>
        <p class="intro">
          {{ dataset
            ? 'Review saved dataset metadata, runtime status, and quick actions from one focused detail page.'
            : 'The selected dataset could not be found in the saved registry.' }}
        </p>
      </div>
      <div class="dashboard-actions">
        <button type="button" class="secondary-action" @click="$emit('back-to-workspace-datasets')">
          Back to Workspace Datasets
        </button>
      </div>
    </div>

    <template v-if="dataset">
      <section class="selection-card">
      <div class="selection-card-header">
        <div>
          <h2>Dataset overview</h2>
          <p>Saved dataset record, source path, status, and operational actions.</p>
        </div>
        <div class="selection-card-meta">
          <span v-if="dataset.id === activeDatasetId">Active dataset</span>
          <span>{{ dataset.status?.sessionAvailable !== false ? 'Live session available' : 'Saved as stale' }}</span>
        </div>
      </div>

      <div class="workspace-dataset-status-list dataset-detail-status-list">
        <span v-if="dataset.id === activeDatasetId" class="workspace-dataset-badge active">Active</span>
        <span
          :class="[
            'workspace-dataset-badge',
            dataset.status?.sessionAvailable !== false ? 'live' : 'stale',
          ]"
        >
          {{ dataset.status?.sessionAvailable !== false ? 'Live Session' : 'Stale Session' }}
        </span>
        <span v-if="dataset.status?.orthancImported" class="workspace-dataset-badge imported">Imported</span>
        <span v-if="hasIgnoredFiles" class="workspace-dataset-badge ignored">Ignored Files</span>
        <span v-if="isRecentDataset" class="workspace-dataset-badge recent">Recent</span>
      </div>

      <div class="workspace-dataset-expanded-summary dataset-detail-summary-grid">
        <div class="dataset-detail-summary-item"><strong>Dataset name:</strong> {{ dataset.sourceLabel || dataset.label }}</div>
        <div class="dataset-detail-summary-item"><strong>Source path:</strong> {{ dataset.sourcePath || 'Not saved' }}</div>
        <div class="dataset-detail-summary-item"><strong>Source type:</strong> {{ dataset.sourceType || 'uploaded' }}</div>
        <div class="dataset-detail-summary-item"><strong>Current location:</strong> {{ dataset.currentPath || 'Root' }}</div>
        <div class="dataset-detail-summary-item"><strong>Selected files:</strong> {{ dataset.summary?.selectedFiles || 0 }}</div>
        <div class="dataset-detail-summary-item"><strong>DICOM files:</strong> {{ dataset.summary?.dicomFiles || 0 }}</div>
        <div class="dataset-detail-summary-item"><strong>Ignored files:</strong> {{ dataset.summary?.ignoredFileCount || 0 }}</div>
        <div class="dataset-detail-summary-item"><strong>Folders:</strong> {{ dataset.summary?.folderCount || 0 }}</div>
        <div class="dataset-detail-summary-item"><strong>Studies:</strong> {{ dataset.summary?.studyCount || 0 }}</div>
        <div class="dataset-detail-summary-item"><strong>Series:</strong> {{ dataset.summary?.seriesCount || 0 }}</div>
        <div class="dataset-detail-summary-item"><strong>Created:</strong> {{ formatIsoTimestamp(dataset.createdAt) }}</div>
        <div class="dataset-detail-summary-item"><strong>Last opened:</strong> {{ formatIsoTimestamp(dataset.lastOpenedAt || dataset.updatedAt || dataset.createdAt) }}</div>
        <div class="dataset-detail-summary-item"><strong>Registry updated:</strong> {{ formatIsoTimestamp(dataset.updatedAt) }}</div>
        <div class="dataset-detail-summary-item"><strong>Last session validated:</strong> {{ formatIsoTimestamp(dataset.lastSessionValidatedAt) || 'Not yet validated' }}</div>
        <div class="dataset-detail-summary-item"><strong>Session id:</strong> {{ dataset.sessionId || 'Unavailable' }}</div>
        <div class="dataset-detail-summary-item"><strong>Registry id:</strong> {{ dataset.id }}</div>
      </div>
      </section>

      <section class="selection-card dataset-detail-actions-card">
        <div class="dataset-detail-actions-copy">
          <h2>Quick actions</h2>
          <p>Open, inspect, export, or remove this dataset from one place.</p>
        </div>
        <div class="workspace-dataset-expanded-actions dataset-detail-actions">
          <button
            type="button"
            class="secondary-action"
            :disabled="datasetSwitchLoadingId === dataset.id || dataset.status?.sessionAvailable === false"
            @click="$emit('open-dataset', dataset.id)"
          >
            {{ dataset.status?.sessionAvailable === false ? 'Session Unavailable' : dataset.id === activeDatasetId ? 'Open Active Dataset' : 'Open Dataset' }}
          </button>
          <button
            type="button"
            class="secondary-action"
            :disabled="datasetSwitchLoadingId === dataset.id || dataset.status?.sessionAvailable === false"
            @click="$emit('open-dataset-analytics', dataset.id)"
          >
            Analytics
          </button>
          <button
            type="button"
            class="secondary-action"
            :disabled="datasetSwitchLoadingId === dataset.id || dataset.status?.sessionAvailable === false"
            @click="$emit('export-dataset-summary', dataset.id)"
          >
            Export Summary
          </button>
          <button
            type="button"
            class="secondary-action"
            :disabled="datasetSwitchLoadingId === dataset.id || dataset.status?.sessionAvailable === false"
            @click="$emit('clear-dataset-imported-studies', dataset.id)"
          >
            Clear Imports
          </button>
          <button
            type="button"
            class="secondary-action danger-action"
            :disabled="datasetSwitchLoadingId === dataset.id"
            @click="$emit('remove-saved-dataset', dataset.id)"
          >
            Remove Saved Dataset
          </button>
          <button
            type="button"
            class="secondary-action danger-action"
            :disabled="datasetSwitchLoadingId === dataset.id"
            @click="$emit('remove-dataset-everywhere', dataset.id)"
          >
            Remove Dataset Everywhere
          </button>
        </div>
      </section>
    </template>

    <section v-else class="selection-card empty-workspace-card">
      <div class="selection-card-header">
        <div>
          <h2>Dataset not found</h2>
          <p>The saved dataset may have been removed or the page was opened without a selected dataset id.</p>
        </div>
      </div>
      <div class="dashboard-actions">
        <button type="button" class="primary" @click="$emit('back-to-workspace-datasets')">
          Return to Workspace Datasets
        </button>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps([
  'dataset',
  'activeDatasetId',
  'datasetSwitchLoadingId',
  'formatIsoTimestamp',
]);

const hasIgnoredFiles = computed(() => Number(props.dataset?.summary?.ignoredFileCount || 0) > 0);

const isRecentDataset = computed(() => {
  const reference = props.dataset?.lastOpenedAt || props.dataset?.updatedAt || props.dataset?.createdAt;
  if (!reference) {
    return false;
  }

  const timestamp = new Date(reference).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return (Date.now() - timestamp) <= 1000 * 60 * 60 * 24;
});

defineEmits([
  'back-to-workspace-datasets',
  'open-dataset',
  'open-dataset-analytics',
  'export-dataset-summary',
  'clear-dataset-imported-studies',
  'remove-saved-dataset',
  'remove-dataset-everywhere',
]);
</script>
