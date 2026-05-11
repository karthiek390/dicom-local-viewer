<template>
  <section class="analysis-card analytics-page-card">
    <p class="eyebrow">Analytics & Activity</p>
    <h1>Session analytics and support tools</h1>
    <p class="intro">
      Review local usage and session-level actions here so the datasets workspace stays focused on browsing and viewing.
    </p>

    <div class="analytics-grid">
      <div class="analytics-primary-column">
        <div class="confidence-strip analytics-confidence-strip">
          <div class="confidence-card">
            <span class="dashboard-card-label">Session</span>
            <strong>{{ summary ? 'Active' : 'Unavailable' }}</strong>
            <p>{{ summary ? `${summary.dicomFiles} DICOM files across ${summary.folderCount} folders.` : 'Upload a folder to create a local analysis session.' }}</p>
          </div>
          <div class="confidence-card">
            <span class="dashboard-card-label">Recent activity</span>
            <strong>{{ activityLog.length }}</strong>
            <p>Only the latest actions are shown to keep this page lightweight.</p>
          </div>
          <div class="confidence-card">
            <span class="dashboard-card-label">Viewer launches</span>
            <strong>{{ openedViewerSelections.length }}</strong>
            <p>OHIF launches recorded for this browser session.</p>
          </div>
          <div class="confidence-card">
            <span class="dashboard-card-label">Recent locations</span>
            <strong>{{ recentLocations.length }}</strong>
            <p>Quick-return dataset locations stored locally.</p>
          </div>
        </div>

        <div v-if="usageIndicators" class="usage-card">
          <div class="usage-header">
            <div>
              <h3>Local Usage</h3>
              <p>Lightweight indicators for staged session files and local Orthanc growth.</p>
            </div>
            <button
              type="button"
              class="secondary-action"
              :disabled="usageLoading"
              @click="$emit('refresh-usage')"
            >
              {{ usageLoading ? 'Refreshing...' : 'Refresh Usage' }}
            </button>
          </div>

          <div class="usage-grid">
            <div class="usage-item">
              <span>Staged DICOM Files</span>
              <strong>{{ usageIndicators.staging.stagedDicomCount }}</strong>
            </div>
            <div class="usage-item">
              <span>API Temp Storage</span>
              <strong>{{ formatFileSize(usageIndicators.staging.stagedDicomBytes) }}</strong>
            </div>
            <div class="usage-item">
              <span>Session Imported Studies</span>
              <strong>{{ usageIndicators.orthanc.importedStudyCount }}</strong>
            </div>
            <div class="usage-item">
              <span>Orthanc Stored Studies</span>
              <strong>{{ usageIndicators.orthanc.studyCount ?? 'Unavailable' }}</strong>
            </div>
            <div class="usage-item">
              <span>Orthanc Stored Instances</span>
              <strong>{{ usageIndicators.orthanc.instanceCount ?? 'Unavailable' }}</strong>
            </div>
            <div class="usage-item">
              <span>Orthanc Disk Usage</span>
              <strong>{{ usageIndicators.orthanc.diskBytes !== null ? formatFileSize(usageIndicators.orthanc.diskBytes) : 'Unavailable' }}</strong>
            </div>
          </div>

          <p v-if="!usageIndicators.orthanc.available" class="usage-note">
            Orthanc usage details are currently unavailable, so only session staging indicators are shown.
          </p>
        </div>

        <div
          v-if="ignoredFileSummary && ignoredFileSummary.ignoredFileCount > 0"
          class="ignored-files-card"
        >
          <div class="ignored-files-header">
            <div>
              <h3>Ignored During Analysis</h3>
              <p>
                {{ ignoredFileSummary.ignoredFileCount }} non-DICOM file{{ ignoredFileSummary.ignoredFileCount === 1 ? '' : 's' }}
                were skipped and not sent to the viewer workflow.
              </p>
            </div>
            <button
              type="button"
              class="ignored-files-toggle"
              @click="$emit('toggle-ignored-files')"
            >
              {{ showIgnoredFiles ? 'Hide Details' : 'Show Details' }}
            </button>
          </div>

          <div class="ignored-files-types">
            <span
              v-for="entry in ignoredFileExtensions"
              :key="entry.extension"
              class="ignored-files-chip"
            >
              {{ entry.extension }}: {{ entry.count }}
            </span>
          </div>

          <div v-if="showIgnoredFiles" class="ignored-files-details">
            <p class="ignored-files-copy">Sample ignored paths</p>
            <ul class="ignored-files-list">
              <li
                v-for="samplePath in ignoredFileSummary.samplePaths"
                :key="samplePath"
              >
                {{ samplePath }}
              </li>
            </ul>
            <p
              v-if="ignoredFileSummary.hasMore"
              class="ignored-files-copy"
            >
              Additional ignored files were omitted from this preview.
            </p>
          </div>
        </div>

        <div v-if="activityLog.length > 0" class="activity-log-card">
          <div class="activity-log-header">
            <div>
              <h3>Session Activity</h3>
              <p>Recent local actions for this active browser session.</p>
            </div>
            <button
              type="button"
              class="secondary-action"
              @click="$emit('clear-activity-log')"
            >
              Clear Log
            </button>
          </div>

          <div class="activity-log-list">
            <div
              v-for="entry in analyticsActivityEntries"
              :key="entry.id"
              class="activity-log-entry"
            >
              <div class="activity-log-meta">
                <strong>{{ entry.title }}</strong>
                <span>{{ formatActivityTimestamp(entry.timestamp) }}</span>
              </div>
              <p>{{ entry.message }}</p>
            </div>
          </div>
          <p v-if="activityLog.length > analyticsActivityEntries.length" class="usage-note">
            Showing the latest {{ analyticsActivityEntries.length }} actions to keep this view focused.
          </p>
        </div>
      </div>

      <div class="analytics-support-column">
        <div class="lifecycle-card">
          <div>
            <h3>Local Data Behavior</h3>
            <p>
              Theme and viewer mode are kept in the browser. The analyzed session and recursive
              folder model stay available while this local stack is running. Imported DICOM studies
              stay in local Orthanc until you clear them.
            </p>
          </div>
          <div class="lifecycle-actions">
            <button
              type="button"
              class="secondary-action"
              :disabled="!analysisSessionId || summaryExporting || currentFolderLoading"
              @click="$emit('export-summary', 'json')"
            >
              {{ summaryExporting ? 'Preparing Summary...' : 'Export Summary JSON' }}
            </button>
            <button
              type="button"
              class="secondary-action"
              :disabled="!analysisSessionId || summaryExporting || currentFolderLoading"
              @click="$emit('export-summary', 'text')"
            >
              {{ summaryExporting ? 'Preparing Summary...' : 'Export Summary Text' }}
            </button>
            <button
              type="button"
              class="secondary-action"
              :disabled="!analysisSessionId || importing || currentFolderLoading"
              @click="$emit('clear-imported-studies')"
            >
              Clear Imported Studies
            </button>
            <button
              type="button"
              class="secondary-action"
              :disabled="!analysisSessionId || importing || currentFolderLoading"
              @click="$emit('clear-current-session')"
            >
              Clear Current Session
            </button>
            <button
              type="button"
              class="secondary-action danger-action"
              :disabled="!analysisSessionId || importing || currentFolderLoading"
              @click="$emit('remove-dataset-everywhere')"
            >
              Remove Dataset Everywhere
            </button>
          </div>
        </div>

        <div class="dashboard-recent-card analytics-summary-card">
          <span class="dashboard-card-label">Current session</span>
          <strong>{{ summary ? `${summary.dicomFiles} DICOM files across ${summary.folderCount} folders` : 'No active dataset loaded' }}</strong>
          <p>
            {{ summary ? `Current selection: ${currentNode.label}. Use Datasets to browse and open studies.` : 'Upload a local folder to generate analytics and dataset details.' }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps([
  'summary',
  'activityLog',
  'openedViewerSelections',
  'recentLocations',
  'usageIndicators',
  'usageLoading',
  'formatFileSize',
  'ignoredFileSummary',
  'showIgnoredFiles',
  'ignoredFileExtensions',
  'analyticsActivityEntries',
  'formatActivityTimestamp',
  'analysisSessionId',
  'summaryExporting',
  'currentFolderLoading',
  'importing',
  'currentNode',
]);

defineEmits([
  'refresh-usage',
  'toggle-ignored-files',
  'clear-activity-log',
  'export-summary',
  'clear-imported-studies',
  'clear-current-session',
  'remove-dataset-everywhere',
]);
</script>
