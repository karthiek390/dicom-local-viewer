<template>
  <section class="hero-card dashboard-page">
    <h1>Dashboard</h1>
    <p class="intro">
      Return to recent work, open the dataset workspace, or start a fresh local analysis.
    </p>

    <div class="dashboard-grid">
      <div class="dashboard-summary-card">
        <span class="dashboard-card-label">Recent session</span>
        <strong>{{ summary ? 'Active local dataset' : (recentActiveSession ? 'Recent session available' : 'No active dataset yet') }}</strong>
        <p>
          {{ dashboardRecentSessionText }}
        </p>
      </div>

      <div class="dashboard-summary-card">
        <span class="dashboard-card-label">Viewer mode</span>
        <strong>{{ viewerMode === 'same-tab' ? 'Same-tab viewer' : 'New-tab viewer' }}</strong>
        <p>Your preferred OHIF launch mode is saved locally in this browser.</p>
      </div>

      <div class="dashboard-summary-card">
        <span class="dashboard-card-label">Current location</span>
        <strong>{{ dashboardCurrentLocation }}</strong>
        <p>{{ summary ? 'Resume from the last selected dataset location.' : 'The last saved dataset location appears here when available.' }}</p>
      </div>

      <div class="dashboard-summary-card">
        <span class="dashboard-card-label">Last viewer open</span>
        <strong>{{ lastOpenedSelection ? lastOpenedSelection.label : 'No viewer launch yet' }}</strong>
        <p>
          {{ lastOpenedSelection ? `${lastOpenedSelection.fileCount} file${lastOpenedSelection.fileCount === 1 ? '' : 's'} opened across ${lastOpenedSelection.studyCount || 0} stud${lastOpenedSelection.studyCount === 1 ? 'y' : 'ies'}.` : 'Open a study or file in OHIF to see it here.' }}
        </p>
      </div>
    </div>

    <div class="dashboard-actions">
      <button type="button" class="primary" @click="$emit('navigate', 'upload')">
        Upload Dataset
      </button>
      <button
        type="button"
        class="secondary-action"
        :disabled="!summary"
        @click="$emit('navigate', 'datasets')"
      >
        Open Datasets
      </button>
      <button
        v-if="lastOpenedSelection?.viewerUrl"
        type="button"
        class="secondary-action"
        @click="$emit('open-dashboard-viewer-link', lastOpenedSelection.viewerUrl)"
      >
        Reopen Last Viewer
      </button>
      <button
        v-if="!summary && recentActiveSession"
        type="button"
        class="secondary-action"
        :disabled="resumeSessionLoading"
        @click="$emit('resume-recent-session')"
      >
        {{ resumeSessionLoading ? 'Resuming...' : 'Resume Recent Session' }}
      </button>
    </div>

    <div class="confidence-strip">
      <div class="confidence-card">
        <span class="dashboard-card-label">Session</span>
        <strong>{{ summary ? 'Active' : (recentActiveSession ? 'Saved' : 'Empty') }}</strong>
        <p>{{ summary ? `${summary.dicomFiles} DICOM files ready to browse.` : (recentActiveSession ? 'A recent local session can be resumed.' : 'Upload a folder to begin.') }}</p>
      </div>
      <div class="confidence-card">
        <span class="dashboard-card-label">Viewer history</span>
        <strong>{{ openedViewerSelections.length }}</strong>
        <p>Recent OHIF launches saved for this browser session.</p>
      </div>
      <div class="confidence-card">
        <span class="dashboard-card-label">Recent activity</span>
        <strong>{{ activityLog.length }}</strong>
        <p>Local actions tracked for this single-user workspace.</p>
      </div>
      <div class="confidence-card">
        <span class="dashboard-card-label">Recent locations</span>
        <strong>{{ recentLocations.length }}</strong>
        <p>Saved dataset locations you can return to quickly.</p>
      </div>
    </div>

    <div v-if="dashboardRecentDatasets.length > 0" class="dashboard-recent-card">
      <div class="activity-log-header">
        <div>
          <h3>Recent Datasets</h3>
          <p>The latest saved datasets in this local workspace, including stale records that may need re-analysis.</p>
        </div>
      </div>

      <div class="dashboard-dataset-list">
        <div
          v-for="dataset in dashboardRecentDatasets"
          :key="dataset.id"
          class="dashboard-dataset-item"
        >
          <div class="dashboard-dataset-copy">
            <strong>{{ dataset.label }}</strong>
            <span>{{ dataset.sourceLabel || dataset.sourcePath || 'Saved dataset' }}</span>
            <small>
              {{ dataset.summary?.dicomFiles || 0 }} DICOM file{{ dataset.summary?.dicomFiles === 1 ? '' : 's' }}
              · {{ dataset.status?.sessionAvailable !== false ? 'Live session' : 'Stale saved dataset' }}
            </small>
          </div>
          <div class="dashboard-dataset-actions">
            <button
              type="button"
              class="secondary-action"
              @click="$emit('open-dashboard-dataset-detail', dataset.id)"
            >
              View Details
            </button>
            <button
              type="button"
              class="secondary-action"
              :disabled="dataset.status?.sessionAvailable === false"
              @click="$emit('open-dashboard-dataset', dataset.id)"
            >
              {{ dataset.status?.sessionAvailable === false ? 'Session Unavailable' : 'Open Dataset' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="usageIndicators" class="dashboard-highlight-grid">
      <div class="dashboard-highlight-card">
        <span class="dashboard-card-label">Staged DICOM</span>
        <strong>{{ usageIndicators.staging.stagedDicomCount }}</strong>
        <p>{{ formatFileSize(usageIndicators.staging.stagedDicomBytes) }} currently staged in the local API session.</p>
      </div>
      <div class="dashboard-highlight-card">
        <span class="dashboard-card-label">Imported Studies</span>
        <strong>{{ usageIndicators.orthanc.importedStudyCount }}</strong>
        <p>Studies currently imported into local Orthanc for this session.</p>
      </div>
      <div class="dashboard-highlight-card">
        <span class="dashboard-card-label">Orthanc Usage</span>
        <strong>{{ usageIndicators.orthanc.diskBytes !== null ? formatFileSize(usageIndicators.orthanc.diskBytes) : 'Unavailable' }}</strong>
        <p>Current local Orthanc disk usage when available.</p>
      </div>
    </div>

    <div v-if="openedViewerSelections.length > 0" class="dashboard-recent-card">
      <div class="activity-log-header">
        <div>
          <h3>Recently Opened in Viewer</h3>
          <p>Quick return links for the most recent OHIF launches from this browser session.</p>
        </div>
      </div>

      <div class="dashboard-opened-list">
        <button
          v-for="entry in openedViewerSelections.slice(0, 4)"
          :key="entry.timestamp"
          type="button"
          class="dashboard-opened-item"
          @click="$emit('open-dashboard-viewer-link', entry.viewerUrl)"
        >
          <strong>{{ entry.label }}</strong>
          <span>{{ entry.fileCount }} file{{ entry.fileCount === 1 ? '' : 's' }} &middot; {{ entry.studyCount || 0 }} stud{{ entry.studyCount === 1 ? 'y' : 'ies' }}</span>
        </button>
      </div>
    </div>

    <div v-if="activityLog.length > 0" class="activity-log-card dashboard-activity-card">
      <div class="activity-log-header">
        <div>
          <h3>Recent Activity</h3>
          <p>The latest actions from this local browser session.</p>
        </div>
      </div>

      <div class="activity-log-list">
        <div
          v-for="entry in activityLog.slice(0, 4)"
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
    </div>
  </section>
</template>

<script setup>
defineProps([
  'summary',
  'recentActiveSession',
  'dashboardRecentSessionText',
  'dashboardRecentDatasets',
  'viewerMode',
  'dashboardCurrentLocation',
  'lastOpenedSelection',
  'resumeSessionLoading',
  'openedViewerSelections',
  'activityLog',
  'recentLocations',
  'usageIndicators',
  'formatFileSize',
  'formatActivityTimestamp',
]);

defineEmits([
  'navigate',
  'resume-recent-session',
  'open-dashboard-viewer-link',
  'open-dashboard-dataset',
  'open-dashboard-dataset-detail',
]);
</script>
