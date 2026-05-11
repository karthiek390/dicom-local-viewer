<template>
  <section class="hero-card upload-page-card">
    <h1>Upload</h1>
    <p class="intro">
      Stage a local folder, create a dataset in the local stack, and continue into the dataset workspace.
    </p>

    <div class="upload-workspace-grid">
      <div
        class="upload-primary-panel"
        :class="{ 'upload-drag-active': isUploadDragActive }"
        @dragenter.prevent="$emit('upload-drag-enter', $event)"
        @dragover.prevent="$emit('upload-drag-over', $event)"
        @dragleave.prevent="$emit('upload-drag-leave', $event)"
        @drop.prevent="$emit('upload-drop', $event)"
      >
        <div class="upload-panel-header">
          <div>
            <span class="dashboard-card-label">Step 1</span>
            <h2>Stage a Dataset Folder</h2>
            <p>
              Choose a folder from your machine, let the app create the local dataset workspace,
              and then continue to the datasets page for browsing and viewing.
            </p>
          </div>
        </div>

        <div class="controls upload-controls">
          <label class="file-picker">
            <span>Select Dataset Folder</span>
            <input
              :ref="setFolderInputRef"
              class="sr-only-file-input"
              type="file"
              multiple
              webkitdirectory
              directory
              @change="$emit('folder-selected', $event)"
            />
            <button
              type="button"
              class="file-picker-button"
              :disabled="analyzing"
              @click="$emit('open-upload-guide')"
            >
              {{ analyzing ? 'Creating Dataset...' : 'Choose Folder' }}
            </button>
            <small class="file-picker-status">{{ selectedFolderLabel }}</small>
          </label>

          <label class="toggle">
            <span>Open viewer mode</span>
            <select :value="viewerMode" @change="$emit('update:viewer-mode', $event.target.value)">
              <option value="same-tab">Same tab</option>
              <option value="new-tab">New tab</option>
            </select>
          </label>
        </div>

        <label class="upload-source-path-field">
          <span>Dataset source path</span>
          <input
            :value="datasetSourcePathInput"
            type="text"
            placeholder="Examples: C:\\Datasets\\StudyA, /Users/name/Datasets/StudyA, /home/name/datasets/StudyA"
            @input="$emit('update:dataset-source-path-input', $event.target.value)"
          />
          <div class="upload-source-path-actions">
            <button
              type="button"
              class="secondary-action"
              :disabled="analyzing || !datasetSourcePathInput.trim()"
              @click="$emit('upload-dataset-from-path')"
            >
              {{ analyzing ? 'Creating Dataset...' : 'Upload Dataset From Path' }}
            </button>
          </div>
          <small>
            This flow needs backend access to a configured local source root inside Docker. Use
            `Choose Folder` if you want the browser picker workflow instead.
          </small>
          <p
            class="upload-source-path-guidance"
            :class="{ error: Boolean(datasetSourcePathError) }"
          >
            {{
              datasetSourcePathError
                || 'Enter an absolute dataset path to let the local API analyze it directly.'
            }}
          </p>
        </label>

        <div
          v-if="isUploadDragActive"
          class="upload-drop-overlay"
          aria-live="polite"
        >
          <strong>Drop folder to analyze locally</strong>
          <span>The folder stays on this machine while the local stack stages the dataset.</span>
        </div>

        <div class="upload-status-strip">
          <div class="upload-status-item">
            <span class="dashboard-card-label">Dataset Source</span>
            <strong>{{ selectedFolderLabel }}</strong>
          </div>
          <div class="upload-status-item">
            <span class="dashboard-card-label">Viewer Target</span>
            <strong>{{ viewerMode === 'same-tab' ? 'Same-tab' : 'New-tab' }}</strong>
          </div>
          <div class="upload-status-item">
            <span class="dashboard-card-label">Creation Status</span>
            <strong>{{ uploadStatusLabel }}</strong>
          </div>
        </div>

        <div v-if="hasUploadProgress" class="upload-progress-card" :class="uploadProgressStatus">
          <div class="upload-progress-copy">
            <span class="dashboard-card-label">Dataset Upload Progress</span>
            <strong>
              {{
                uploadProgressStatus === 'completed'
                  ? 'Upload Complete'
                  : uploadProgressStatus === 'failed'
                    ? 'Upload Failed'
                    : 'Creating Dataset'
              }}
            </strong>
            <p>{{ uploadProgressLabel }}</p>
          </div>
          <div
            class="upload-progress-bar"
            role="progressbar"
            aria-label="Dataset upload progress"
            :aria-valuemin="0"
            :aria-valuemax="100"
            :aria-valuenow="uploadProgressPercent"
          >
            <span class="upload-progress-bar-fill" :style="{ width: `${uploadProgressPercent}%` }" />
          </div>
          <div class="upload-progress-footer">
            <span>{{ uploadProgressPercent }}%</span>
            <span>{{ uploadProgressDetail }}</span>
          </div>
        </div>

        <div class="page-inline-note viewer-mode-note">
          Viewer target:
          <strong>{{ viewerModeTitle }}</strong>
          <span>{{ viewerModeHint }}</span>
        </div>

        <div
          v-if="workspaceGuardrail"
          class="page-inline-note workspace-guardrail-note"
          :class="workspaceGuardrail.level"
        >
          Workspace size:
          <strong>{{ workspaceGuardrail.totalDatasets }} saved dataset{{ workspaceGuardrail.totalDatasets === 1 ? '' : 's' }}</strong>
          <span>{{ workspaceGuardrail.message }}</span>
        </div>

        <div class="page-inline-note">
          You can also drag and drop a local folder onto this panel to stage and create a dataset.
        </div>

        <div class="page-inline-note">
          Local-only workflow. Need storage details or privacy behavior? Open
          <button type="button" class="inline-page-link" @click="$emit('navigate', 'about')">
            About & Privacy
          </button>.
        </div>
      </div>

      <div class="upload-side-panel">
        <div class="upload-helper-card">
          <span class="dashboard-card-label">Dataset Creation Flow</span>
          <ol class="upload-steps-list">
            <li>Open the folder-selection dialog and approve browser access.</li>
            <li>The local API stages the dataset and counts DICOM versus ignored files.</li>
            <li>You continue to the datasets workspace to browse, inspect, and open studies.</li>
          </ol>
        </div>

        <div v-if="summary" class="upload-helper-card upload-ready-card">
          <span class="dashboard-card-label">Latest Dataset</span>
          <strong>Dataset Workspace Ready</strong>
          <p>
            {{ summary.dicomFiles }} DICOM file{{ summary.dicomFiles === 1 ? '' : 's' }} across
            {{ summary.folderCount }} folder{{ summary.folderCount === 1 ? '' : 's' }} are ready in the current dataset workspace.
          </p>
          <button
            type="button"
            class="secondary-action"
            @click="$emit('navigate', 'datasets')"
          >
            Open Dataset Workspace
          </button>
        </div>

        <div v-else-if="recentActiveSession" class="upload-helper-card">
          <span class="dashboard-card-label">Recent Session</span>
          <strong>Resume Recent Dataset Workspace</strong>
          <p>
            Return to <span class="resume-session-label">{{ recentActiveSession.currentPath || 'Root' }}</span>
            from your latest local dataset workspace.
          </p>
          <button
            type="button"
            class="secondary-action"
            :disabled="resumeSessionLoading"
            @click="$emit('resume-recent-session')"
          >
            {{ resumeSessionLoading ? 'Resuming...' : 'Resume Dataset Workspace' }}
          </button>
        </div>

        <div class="upload-helper-card">
          <span class="dashboard-card-label">Details</span>
          <strong>Need local storage guidance?</strong>
          <p>
            Browser state, local API staging, and Orthanc behavior are documented in one place.
          </p>
          <button
            type="button"
            class="secondary-action"
            @click="$emit('navigate', 'about')"
          >
            Open About & Privacy
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps([
  'setFolderInputRef',
  'isUploadDragActive',
  'analyzing',
  'hasUploadProgress',
  'uploadProgressStatus',
  'uploadProgressPercent',
  'uploadProgressLabel',
  'uploadProgressDetail',
  'selectedFolderLabel',
  'datasetSourcePathInput',
  'datasetSourcePathError',
  'viewerMode',
  'viewerModeTitle',
  'viewerModeHint',
  'workspaceGuardrail',
  'summary',
  'recentActiveSession',
  'resumeSessionLoading',
]);

const uploadStatusLabel = computed(() => {
  if (props.analyzing) {
    return 'Creating dataset locally...';
  }

  if (props.summary) {
    return 'Dataset workspace ready';
  }

  if (props.selectedFolderLabel && props.selectedFolderLabel !== 'No dataset folder staged') {
    return 'Ready to create dataset';
  }

  return 'Awaiting dataset folder';
});

defineEmits([
  'open-upload-guide',
  'folder-selected',
  'update:dataset-source-path-input',
  'upload-dataset-from-path',
  'update:viewer-mode',
  'upload-drag-enter',
  'upload-drag-over',
  'upload-drag-leave',
  'upload-drop',
  'resume-recent-session',
  'navigate',
]);
</script>

<style scoped>
.upload-progress-card {
  margin-top: 1rem;
  padding: 1rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(27, 39, 51, 0.12);
  background: #ffffff;
  display: grid;
  gap: 0.7rem;
}

.upload-progress-card.running {
  border-color: rgba(145, 92, 27, 0.24);
}

.upload-progress-card.completed {
  border-color: rgba(42, 110, 78, 0.28);
}

.upload-progress-card.failed {
  border-color: rgba(153, 54, 38, 0.28);
}

.upload-progress-copy {
  display: grid;
  gap: 0.2rem;
}

.upload-progress-copy strong {
  font-size: 1rem;
  color: #1b2733;
}

.upload-progress-copy p {
  margin: 0;
  color: #4a5563;
  overflow-wrap: anywhere;
}

.upload-progress-bar {
  position: relative;
  height: 0.8rem;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(27, 39, 51, 0.1);
}

.upload-progress-bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #fde68a 0%, #facc15 35%, #f97316 70%, #22c55e 100%);
  transition: width 180ms ease;
}

.upload-progress-card.failed .upload-progress-bar-fill {
  background: linear-gradient(90deg, #b24b3a, #de7b68);
}

.upload-progress-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  color: #5b6673;
}
</style>
