<template>
  <div class="app-shell" :data-theme="theme">
    <ToastStack :toasts="toasts" @dismiss="dismissToast" />

    <AppShell
      :theme="theme"
      :current-portal-page="currentPortalPage"
      :current-portal-page-label="currentPortalPageLabel"
      :sidebar-status-message="sidebarStatusMessage"
      :is-sidebar-collapsed="isSidebarCollapsed"
      :is-sidebar-open="isSidebarOpen"
      :show-sidebar-overlay="showSidebarOverlay"
      :navigation-items="portalNavigationItems"
      :is-loading="analyzing || importing"
      :loading-percent="importing ? importProgressPercent : (analyzing ? uploadProgressPercent : 0)"
      @toggle-theme="toggleTheme"
      @toggle-sidebar="toggleSidebar"
      @close-sidebar-mobile="closeSidebarOnMobile"
      @navigate="navigateToPortalPage"
    >
      <div
        v-if="showUploadGuideModal"
        class="modal-backdrop"
        @click.self="closeUploadGuideModal"
      >
        <section class="upload-guide-modal" role="dialog" aria-modal="true" aria-labelledby="upload-guide-title">
          <p class="eyebrow">Upload</p>
          <h2 id="upload-guide-title">Analyze a local DICOM folder</h2>
          <p>
            The next browser step is a native security prompt that asks you to confirm local folder
            access. After you approve it, this app will analyze the selected folder inside your
            local Docker stack and keep the files on your machine.
          </p>
          <ul class="upload-guide-list">
            <li>Choose a local folder that contains your DICOM files.</li>
            <li>Approve the browser access prompt when it appears.</li>
            <li>Wait for the local analysis to finish and review the dataset results here.</li>
          </ul>
          <div class="upload-guide-actions">
            <button type="button" class="secondary-action" @click="closeUploadGuideModal">
              Cancel
            </button>
            <button type="button" class="primary" @click="continueToFolderPicker">
              Continue to Folder Selection
            </button>
          </div>
        </section>
      </div>

      <div
        v-if="duplicateUploadConflict"
        class="modal-backdrop"
        @click.self="chooseDuplicateUploadResolution('skip')"
      >
        <section class="upload-guide-modal duplicate-upload-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-upload-title">
          <p class="eyebrow">Upload Conflict</p>
          <h2 id="duplicate-upload-title">{{ duplicateUploadConflict.title }}</h2>
          <p>
            {{ duplicateUploadConflict.message }}
          </p>
          <ul class="upload-guide-list">
            <li
              v-for="dataset in duplicateUploadConflict.matches"
              :key="dataset.id"
            >
              {{ dataset.label }}: {{ dataset.sourceLabel || dataset.sourcePath || 'Saved dataset' }}
            </li>
          </ul>
          <div class="duplicate-upload-actions">
            <button type="button" class="secondary-action" @click="chooseDuplicateUploadResolution('skip')">
              {{ duplicateUploadConflict.skipLabel }}
            </button>
            <button type="button" class="secondary-action" @click="chooseDuplicateUploadResolution('separate')">
              {{ duplicateUploadConflict.separateLabel }}
            </button>
            <button type="button" class="primary" @click="chooseDuplicateUploadResolution(duplicateUploadConflict.primaryAction)">
              {{ duplicateUploadConflict.primaryLabel }}
            </button>
          </div>
        </section>
      </div>

      <div
        v-if="saveChoicePrompt"
        class="modal-backdrop"
        @click.self="cancelSaveChoicePrompt"
      >
        <section class="upload-guide-modal save-choice-modal" role="dialog" aria-modal="true" aria-labelledby="save-choice-title">
          <p class="eyebrow">{{ saveChoicePrompt.eyebrow }}</p>
          <h2 id="save-choice-title">{{ saveChoicePrompt.title }}</h2>
          <p>
            {{ saveChoicePrompt.message }}
          </p>
          <div class="save-choice-options">
            <button
              v-for="option in saveChoicePrompt.options"
              :key="option.value"
              type="button"
              class="save-choice-option"
              :class="{ recommended: option.recommended }"
              @click="resolveSaveChoicePrompt(option.value)"
            >
              <strong>{{ option.label }}</strong>
              <span>{{ option.description }}</span>
            </button>
          </div>
          <div class="upload-guide-actions">
            <button type="button" class="secondary-action" @click="cancelSaveChoicePrompt">
              Cancel
            </button>
          </div>
        </section>
      </div>

      <div
        v-if="workspaceGuardrailPrompt"
        class="modal-backdrop"
        @click.self="cancelWorkspaceGuardrailPrompt"
      >
        <section class="upload-guide-modal save-choice-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-guardrail-title">
          <p class="eyebrow">Workspace Guardrail</p>
          <h2 id="workspace-guardrail-title">{{ workspaceGuardrailPrompt.title }}</h2>
          <p>
            {{ workspaceGuardrailPrompt.message }}
          </p>
          <div class="save-choice-options">
            <button
              v-for="option in workspaceGuardrailPrompt.options"
              :key="option.value"
              type="button"
              class="save-choice-option"
              :class="{ recommended: option.recommended }"
              @click="resolveWorkspaceGuardrailPrompt(option.value)"
            >
              <strong>{{ option.label }}</strong>
              <span>{{ option.description }}</span>
            </button>
          </div>
        </section>
      </div>

      <DashboardPage
        v-if="currentPortalPage === 'dashboard'"
        :summary="summary"
        :recent-active-session="recentActiveSession"
        :dashboard-recent-session-text="dashboardRecentSessionText"
        :dashboard-recent-datasets="dashboardRecentDatasets"
        :viewer-mode="viewerMode"
        :dashboard-current-location="dashboardCurrentLocation"
        :last-opened-selection="lastOpenedSelection"
        :resume-session-loading="resumeSessionLoading"
        :opened-viewer-selections="openedViewerSelections"
        :activity-log="activityLog"
        :recent-locations="recentLocations"
        :usage-indicators="usageIndicators"
        :format-file-size="formatFileSize"
        :format-activity-timestamp="formatActivityTimestamp"
        @navigate="navigateToPortalPage"
        @resume-recent-session="resumeRecentActiveSession"
        @open-dashboard-viewer-link="openDashboardViewerLink"
        @open-dashboard-dataset="openWorkspaceDataset"
        @open-dashboard-dataset-detail="openDatasetDetailPage"
      />
      <UploadPage
        v-if="currentPortalPage === 'upload'"
        :set-folder-input-ref="setFolderInputRef"
        :is-upload-drag-active="isUploadDragActive"
        :analyzing="analyzing"
        :has-upload-progress="hasUploadProgress"
        :upload-progress-status="uploadProgressStatus"
        :upload-progress-percent="uploadProgressPercent"
        :upload-progress-label="uploadProgressLabel"
        :upload-progress-detail="uploadProgressDetail"
        :selected-folder-label="selectedFolderLabel"
        :dataset-source-path-input="datasetSourcePathInput"
        :dataset-source-path-error="datasetSourcePathError"
        :viewer-mode="viewerMode"
        :viewer-mode-title="viewerModeTitle"
        :viewer-mode-hint="viewerModeHint"
        :workspace-guardrail="workspaceGuardrail"
        :summary="summary"
        :recent-active-session="recentActiveSession"
        :resume-session-loading="resumeSessionLoading"
        @open-upload-guide="openUploadGuideModal"
        @folder-selected="onFolderSelected"
        @update:dataset-source-path-input="handleDatasetSourcePathInput"
        @upload-dataset-from-path="analyzeDatasetFromPath"
        @update:viewer-mode="viewerMode = $event"
        @upload-drag-enter="handleUploadDragEnter"
        @upload-drag-over="handleUploadDragOver"
        @upload-drag-leave="handleUploadDragLeave"
        @upload-drop="handleUploadDrop"
        @resume-recent-session="resumeRecentActiveSession"
        @navigate="navigateToPortalPage"
      />
      <DatasetsPage
        v-if="currentPortalPage === 'datasets'"
        :summary="summary"
        :workspace-datasets="paginatedWorkspaceDatasets"
        :saved-dataset-count="availableDatasetRegistry.length"
        :dataset-list-search-input="datasetListSearchInput"
        :dataset-list-sort-mode="datasetListSortMode"
        :dataset-selector-controls="datasetSelectorControls"
        :dataset-selector-page-input="datasetSelectorPageInput"
        :dataset-selector-page-error="datasetSelectorPageError"
        :dataset-selector-page-size="datasetSelectorPageSize"
        :active-dataset-id="activeDatasetId"
        :dataset-switch-loading-id="datasetSwitchLoadingId"
        :recent-active-session="recentActiveSession"
        :resume-session-loading="resumeSessionLoading"
        :recent-upload-success="recentUploadSuccess"
        :breadcrumbs="breadcrumbs"
        :current-node="currentNode"
        :viewer-action-label="viewerActionLabel"
        :analyzing="analyzing"
        :importing="importing"
        :has-import-progress="hasImportProgress"
        :import-progress-status="importProgressStatus"
        :import-progress-total-files="importProgressTotalFiles"
        :import-progress-completed-files="importProgressCompletedFiles"
        :import-progress-failed-files="importProgressFailedFiles"
        :import-progress-percent="importProgressPercent"
        :import-progress-label="importProgressLabel"
        :current-folder-info="currentFolderInfo"
        :current-folder-view-mode="currentFolderViewMode"
        :has-current-folder-overrides="hasCurrentFolderOverrides"
        :current-folder-loading="currentFolderLoading"
        :recent-locations="recentLocations"
        :current-path="currentPath"
        :set-folder-search-input-ref="setFolderSearchInputRef"
        :folder-search-input="folderSearchInput"
        :current-folder-search-scope="currentFolderSearchScope"
        :current-folder-sort-by="currentFolderSortBy"
        :current-folder-sort-dir="currentFolderSortDir"
        :current-folder-extension-filter="currentFolderExtensionFilter"
        :current-folder-size-range="currentFolderSizeRange"
        :current-folder-page-size="currentFolderPageSize"
        :current-folder-controls="currentFolderControls"
        :active-filter-chips="activeFilterChips"
        :selected-inspector-item="selectedInspectorItem"
        :set-inspector-card-ref="setInspectorCardRef"
        :inspector-metadata-summary="inspectorMetadataSummary"
        :inspector-metadata-loading="inspectorMetadataLoading"
        :inspector-metadata-error="inspectorMetadataError"
        :exporting="exporting"
        :format-file-size="formatFileSize"
        :summarize-metadata-value="summarizeMetadataValue"
        :show-grouped-folder-view="showGroupedFolderView"
        :current-folder-grouped-data="currentFolderGroupedData"
        :current-folder-grouped-loading="currentFolderGroupedLoading"
        :current-folder-grouped-error="currentFolderGroupedError"
        :show-table-folder-view="showTableFolderView"
        :current-folder-entries="currentFolderEntries"
        :get-inspector-item-key="getInspectorItemKey"
        :format-parent-path="formatParentPath"
        :build-breadcrumb-buttons="buildBreadcrumbButtons"
        :current-folder-folders="currentFolderFolders"
        :current-folder-files="currentFolderFiles"
        :current-folder-page-input="currentFolderPageInput"
        :current-folder-page-error="currentFolderPageError"
        :tree-children="treeChildren"
        :expanded-paths-list="expandedPathsList"
        @navigate="navigateToPortalPage"
        @resume-recent-session="resumeRecentActiveSession"
        @open-workspace-dataset="openWorkspaceDataset"
        @open-workspace-dataset-analytics="openWorkspaceDatasetAnalytics"
        @update:dataset-list-search-input="datasetListSearchInput = $event"
        @clear-dataset-list-search="datasetListSearchInput = ''"
        @update:dataset-list-sort-mode="datasetListSortMode = $event"
        @update:dataset-selector-page-size="datasetSelectorPageSize = Number($event)"
        @update:dataset-selector-page-input="datasetSelectorPageInput = $event"
        @go-to-dataset-selector-page="goToDatasetSelectorPage"
        @submit-dataset-selector-page="submitDatasetSelectorPage"
        @dismiss-upload-success="dismissRecentUploadSuccess"
        @scroll-to-datasets-area="scrollToDatasetsArea"
        @set-current-path="currentPath = $event"
        @open-current-selection="openCurrentSelection"
        @update:current-folder-view-mode="currentFolderViewMode = $event"
        @reset-current-folder-controls="resetCurrentFolderControls"
        @jump-to-recent-location="jumpToRecentLocation"
        @update:folder-search-input="folderSearchInput = $event"
        @clear-folder-search="clearFolderSearch"
        @update:current-folder-search-scope="currentFolderSearchScope = $event"
        @update:current-folder-sort-by="currentFolderSortBy = $event"
        @update:current-folder-sort-dir="currentFolderSortDir = $event"
        @update:current-folder-extension-filter="currentFolderExtensionFilter = $event"
        @update:current-folder-size-range="currentFolderSizeRange = $event"
        @update:current-folder-page-size="currentFolderPageSize = $event"
        @remove-filter-chip="removeFilterChip"
        @clear-inspector-selection="clearInspectorSelection"
        @copy-inspector-value="(...args) => copyInspectorValue(...args)"
        @inspect-and-select-folder="inspectAndSelectFolder"
        @download-inspector-selection="downloadInspectorSelection"
        @open-inspector-selection="openInspectorSelection"
        @go-to-inspector-parent-folder="goToInspectorParentFolder"
        @open-grouped-paths="openGroupedPaths"
        @select-inspector-item="selectInspectorItem"
        @jump-to-breadcrumb-path="jumpToBreadcrumbPath"
        @go-to-current-folder-page="goToCurrentFolderPage"
        @submit-current-folder-page="submitCurrentFolderPage"
        @update:current-folder-page-input="currentFolderPageInput = $event"
        @toggle-folder="toggleFolder"
        @toggle-overflow="(...args) => toggleOverflow(...args)"
      />
      <WorkspaceDatasetsPage
        v-if="currentPortalPage === 'workspace-datasets'"
        :workspace-datasets="paginatedWorkspaceManagementDatasets"
        :saved-dataset-count="datasetRegistry.length"
        :dataset-list-search-input="datasetListSearchInput"
        :dataset-list-sort-mode="datasetListSortMode"
        :workspace-dataset-controls="workspaceDatasetControls"
        :workspace-dataset-page-input="workspaceDatasetPageInput"
        :workspace-dataset-page-error="workspaceDatasetPageError"
        :workspace-dataset-page-size="workspaceDatasetPageSize"
        :expanded-workspace-dataset-id="expandedWorkspaceDatasetId"
        :active-dataset-id="activeDatasetId"
        :dataset-switch-loading-id="datasetSwitchLoadingId"
        :format-iso-timestamp="formatIsoTimestamp"
        @navigate="navigateToPortalPage"
        @open-dataset-detail="openDatasetDetailPage"
        @open-workspace-dataset="openWorkspaceDataset"
        @open-workspace-dataset-analytics="openWorkspaceDatasetAnalytics"
        @export-workspace-dataset-summary="exportWorkspaceDatasetSummary"
        @clear-workspace-dataset-imported-studies="clearWorkspaceDatasetImportedStudies"
        @remove-workspace-dataset="removeWorkspaceDataset"
        @remove-workspace-dataset-everywhere="removeWorkspaceDatasetEverywhere"
        @update:dataset-list-search-input="datasetListSearchInput = $event"
        @clear-dataset-list-search="datasetListSearchInput = ''"
        @update:dataset-list-sort-mode="datasetListSortMode = $event"
        @update:workspace-dataset-page-size="workspaceDatasetPageSize = Number($event)"
        @update:workspace-dataset-page-input="workspaceDatasetPageInput = $event"
        @go-to-workspace-dataset-page="goToWorkspaceDatasetPage"
        @submit-workspace-dataset-page="submitWorkspaceDatasetPage"
        @toggle-workspace-dataset-expansion="toggleWorkspaceDatasetExpansion"
      />
      <DatasetDetailPage
        v-if="currentPortalPage === 'dataset-detail'"
        :dataset="selectedDatasetDetail"
        :active-dataset-id="activeDatasetId"
        :dataset-switch-loading-id="datasetSwitchLoadingId"
        :format-iso-timestamp="formatIsoTimestamp"
        @back-to-workspace-datasets="navigateToPortalPage('workspace-datasets')"
        @open-dataset="openWorkspaceDataset"
        @open-dataset-analytics="openWorkspaceDatasetAnalytics"
        @export-dataset-summary="exportWorkspaceDatasetSummary"
        @clear-dataset-imported-studies="clearWorkspaceDatasetImportedStudies"
        @remove-saved-dataset="removeWorkspaceDataset"
        @remove-dataset-everywhere="removeWorkspaceDatasetEverywhere"
      />
      <AnalyticsActivityPage
        v-if="currentPortalPage === 'analytics'"
        :summary="summary"
        :activity-log="activityLog"
        :opened-viewer-selections="openedViewerSelections"
        :recent-locations="recentLocations"
        :usage-indicators="usageIndicators"
        :usage-loading="usageLoading"
        :format-file-size="formatFileSize"
        :ignored-file-summary="ignoredFileSummary"
        :show-ignored-files="showIgnoredFiles"
        :ignored-file-extensions="ignoredFileExtensions"
        :analytics-activity-entries="analyticsActivityEntries"
        :format-activity-timestamp="formatActivityTimestamp"
        :analysis-session-id="analysisSessionId"
        :summary-exporting="summaryExporting"
        :current-folder-loading="currentFolderLoading"
        :importing="importing"
        :current-node="currentNode"
        @refresh-usage="refreshUsageIndicators({ showFeedback: true })"
        @toggle-ignored-files="showIgnoredFiles = !showIgnoredFiles"
        @clear-activity-log="clearActivityLog"
        @export-summary="exportSessionSummary"
        @clear-imported-studies="clearImportedStudies"
        @clear-current-session="clearCurrentSession"
        @remove-dataset-everywhere="removeActiveDatasetEverywhere"
      />
      <AboutPrivacyPage
        v-if="currentPortalPage === 'about'"
        :show-help-panel="showHelpPanel"
        @toggle-help-panel="showHelpPanel = !showHelpPanel"
      />
      <ViewerPanel
        v-if="viewerUrl && viewerMode === 'same-tab'"
        :viewer-url="viewerUrl"
        @close="closeViewer"
      />

    </AppShell>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ToastStack from './components/ToastStack.vue';
import ViewerPanel from './components/ViewerPanel.vue';
import { useCurrentFolderBrowser } from './composables/useCurrentFolderBrowser.js';
import { useDatasetSession } from './composables/useDatasetSession.js';
import { useNotifications } from './composables/useNotifications.js';
import { usePortalNavigation } from './composables/usePortalNavigation.js';
import { useViewerFlow } from './composables/useViewerFlow.js';
import AppShell from './layouts/AppShell.vue';
import AboutPrivacyPage from './pages/AboutPrivacyPage.vue';
import AnalyticsActivityPage from './pages/AnalyticsActivityPage.vue';
import DatasetDetailPage from './pages/DatasetDetailPage.vue';
import WorkspaceDatasetsPage from './pages/WorkspaceDatasetsPage.vue';
import DashboardPage from './pages/DashboardPage.vue';
import DatasetsPage from './pages/DatasetsPage.vue';
import UploadPage from './pages/UploadPage.vue';

const QUERY_KEYS = {
  sessionId: 'sid',
  currentPath: 'path',
  search: 'search',
  searchScope: 'scope',
  extension: 'ext',
  sizeRange: 'size',
  sortBy: 'sort',
  sortDir: 'dir',
  pageSize: 'pageSize',
  page: 'page',
};

const RECENT_ACTIVE_SESSION_KEY = 'dicom-local-viewer:recent-active-session';
const theme = ref(localStorage.getItem('site-theme') || 'light');
const folderInput = ref(null);
const inspectorCardRef = ref(null);
const showUploadGuideModal = ref(false);
const selectedFolderLabel = ref('No dataset folder staged');
const datasetSourcePathInput = ref('');
const datasetSourcePathError = ref('');
const selectedDatasetSourcePath = ref('');
const datasetListSearchInput = ref('');
const datasetListSortMode = ref('recent');
const datasetSelectorPage = ref(1);
const datasetSelectorPageSize = ref(5);
const datasetSelectorPageInput = ref('1');
const datasetSelectorPageError = ref('');
const workspaceDatasetPage = ref(1);
const workspaceDatasetPageSize = ref(5);
const workspaceDatasetPageInput = ref('1');
const workspaceDatasetPageError = ref('');
const expandedWorkspaceDatasetId = ref('');
const selectedDatasetDetailId = ref('');
const recentUploadSuccess = ref(null);
const analysisSessionId = ref('');
const analysisSummary = ref(null);
const recentActiveSession = ref(null);
const isUploadDragActive = ref(false);
const resumeSessionLoading = ref(false);
const datasetSwitchLoadingId = ref('');
const ignoredFileSummary = ref(null);
const showIgnoredFiles = ref(false);
const openedViewerSelections = ref([]);
const activityLog = ref([]);
const usageIndicators = ref(null);
const usageLoading = ref(false);
const showHelpPanel = ref(false);
const duplicateUploadConflict = ref(null);
const saveChoicePrompt = ref(null);
const workspaceGuardrail = ref(null);
const workspaceGuardrailPrompt = ref(null);
const treeRoot = ref(null);
const currentPath = ref('');
const analyzing = ref(false);
const uploadProgressStatus = ref('idle');
const uploadProgressPercent = ref(0);
const uploadProgressLabel = ref('');
const uploadProgressDetail = ref('');
const importing = ref(false);
const importJobId = ref('');
const importProgressStatus = ref('idle');
const importProgressTotalFiles = ref(0);
const importProgressCompletedFiles = ref(0);
const importProgressFailedFiles = ref(0);
const importProgressPercent = ref(0);
const importProgressLabel = ref('');
const exporting = ref(false);
const summaryExporting = ref(false);
const isApplyingHistoryState = ref(false);
let importProgressPollTimer = null;
let importProgressResetTimer = null;
let importProgressPollToken = 0;
let uploadProgressResetTimer = null;
let historyStateEnabled = false;
let inspectorMetadataRequestId = 0;
let uploadDragDepth = 0;
let duplicateUploadResolver = null;
let saveChoiceResolver = null;
let workspaceGuardrailResolver = null;
let workspaceGuardrailAcknowledgedToken = '';
const MAX_RECENT_LOCATIONS = 6;
const MAX_OPENED_SELECTIONS = 12;
const MAX_ACTIVITY_LOG_ENTRIES = 24;
const LARGE_SELECTION_WARNING_THRESHOLD = 250;
const VERY_LARGE_SELECTION_WARNING_THRESHOLD = 1000;

function setFolderInputRef(element) {
  folderInput.value = element;
}

function setInspectorCardRef(element) {
  inspectorCardRef.value = element;
}

watch(theme, (value) => {
  localStorage.setItem('site-theme', value);
});

const summary = computed(() => analysisSummary.value);
const hasUploadProgress = computed(() => uploadProgressStatus.value !== 'idle');
const hasImportProgress = computed(() => (
  importProgressStatus.value !== 'idle' || Boolean(importJobId.value)
));
const {
  datasetRegistry,
  activeDatasetId,
  activeDataset,
  loadDatasetRegistry,
  loadDatasetRegistryPage,
  loadDatasetRegistryWorkspaceSummary,
  reconcileDatasetRegistrySessions,
  clearLegacyBrowserDatasetRegistry,
  findDatasetById,
  findDatasetBySessionId,
  upsertDataset,
  updateActiveDataset,
  clearActiveDataset,
  setActiveDatasetById,
  removeDatasetBySessionId,
  removeDatasetById,
} = useDatasetSession();

const availableDatasetRegistry = computed(() => (
  datasetRegistry.value.filter((dataset) => dataset?.status?.sessionAvailable !== false)
));
const selectedDatasetDetail = computed(() => (
  findDatasetById(selectedDatasetDetailId.value) || null
));

const {
  toasts,
  dismissToast,
  showToast,
  showActionSuccess,
  showActionError,
  showActionInfo,
  clearToasts,
} = useNotifications();

const {
  defaultCurrentFolderControls,
  expandedPaths,
  folderSearchInputRef,
  folderSearchInput,
  debouncedFolderSearch,
  currentFolderSearchScope,
  currentFolderExtensionFilter,
  currentFolderSizeRange,
  currentFolderSortBy,
  currentFolderSortDir,
  currentFolderPageSize,
  currentFolderControls,
  currentFolderViewMode,
  currentFolderEntries,
  currentFolderInfo,
  currentFolderPageInput,
  currentFolderPageError,
  currentFolderGroupedData,
  currentFolderGroupedLoading,
  currentFolderGroupedError,
  selectedInspectorItem,
  inspectorMetadataSummary,
  inspectorMetadataLoading,
  inspectorMetadataError,
  recentLocations,
  currentFolderLoading,
  setFolderSearchInputRef,
  currentNode,
  treeChildren,
  expandedPathsList,
  currentFolderFolders,
  currentFolderFiles,
  showGroupedFolderView,
  showTableFolderView,
  selectedInspectorNode,
  breadcrumbs,
  hasCurrentFolderOverrides,
  activeFilterChips,
  clearFolderSearch,
  removeFilterChip,
  getInspectorItemKey,
  resetCurrentFolderControls,
  goToCurrentFolderPage,
  submitCurrentFolderPage,
  toggleFolder,
  jumpToBreadcrumbPath,
  buildBreadcrumbButtons,
  toggleOverflow,
} = useCurrentFolderBrowser({
  treeRoot,
  currentPath,
  findNodeByPath,
  inspectorCardRef,
  fetchCurrentFolderResults,
  fetchCurrentFolderGroupedData,
  loadInspectorMetadata,
  syncHistoryState,
  syncRecentLocationForCurrentState,
  recordRecentLocation,
  captureNavigationState,
  isApplyingHistoryStateRef: isApplyingHistoryState,
});

function resetImportProgressState() {
  if (importProgressPollTimer) {
    window.clearTimeout(importProgressPollTimer);
    importProgressPollTimer = null;
  }
  if (importProgressResetTimer) {
    window.clearTimeout(importProgressResetTimer);
    importProgressResetTimer = null;
  }
  importProgressPollToken += 1;
  importJobId.value = '';
  importProgressStatus.value = 'idle';
  importProgressTotalFiles.value = 0;
  importProgressCompletedFiles.value = 0;
  importProgressFailedFiles.value = 0;
  importProgressPercent.value = 0;
  importProgressLabel.value = '';
}

function initializeImportProgressState(relativePaths = []) {
  if (importProgressPollTimer) {
    window.clearTimeout(importProgressPollTimer);
    importProgressPollTimer = null;
  }
  if (importProgressResetTimer) {
    window.clearTimeout(importProgressResetTimer);
    importProgressResetTimer = null;
  }
  importProgressPollToken += 1;
  const totalFiles = Array.isArray(relativePaths) ? relativePaths.length : 0;
  importJobId.value = '';
  importProgressStatus.value = 'queued';
  importProgressTotalFiles.value = totalFiles;
  importProgressCompletedFiles.value = 0;
  importProgressFailedFiles.value = 0;
  importProgressPercent.value = 0;
  importProgressLabel.value = totalFiles > 0
    ? `Preparing to import ${totalFiles} file${totalFiles === 1 ? '' : 's'} into Orthanc...`
    : 'Preparing to import into Orthanc...';
}

function syncImportProgressFromResponse(payload = {}) {
  importJobId.value = String(payload.jobId || '');
  importProgressStatus.value = 'completed';
  importProgressTotalFiles.value = Number(payload.importedFileCount || 0) + Number(payload.skippedFileCount || 0);
  importProgressCompletedFiles.value = Number(payload.importedFileCount || 0);
  importProgressFailedFiles.value = Number(payload.skippedFileCount || 0);
  importProgressPercent.value = importProgressTotalFiles.value > 0 ? 100 : 0;
  importProgressLabel.value = importProgressFailedFiles.value > 0
    ? `Imported ${importProgressCompletedFiles.value} file${importProgressCompletedFiles.value === 1 ? '' : 's'} into Orthanc with ${importProgressFailedFiles.value} skipped.`
    : `Imported ${importProgressCompletedFiles.value} file${importProgressCompletedFiles.value === 1 ? '' : 's'} into Orthanc.`;
}

function syncImportProgressFromJob(job = {}) {
  importJobId.value = String(job.jobId || importJobId.value || '');
  importProgressStatus.value = String(job.status || 'running');
  importProgressTotalFiles.value = Number(job.totalFiles || 0);
  importProgressFailedFiles.value = Number(job.failedFiles || 0);
  importProgressPercent.value = Number(job.percentComplete || 0);

  if (importProgressStatus.value === 'completed' && Number.isFinite(Number(job.importedFileCount))) {
    importProgressCompletedFiles.value = Number(job.importedFileCount || 0);
    importProgressFailedFiles.value = Number(job.skippedFileCount || importProgressFailedFiles.value || 0);
    importProgressPercent.value = importProgressTotalFiles.value > 0 ? 100 : 0;
  } else {
    importProgressCompletedFiles.value = Number(job.completedFiles || 0);
  }

  const totalFiles = importProgressTotalFiles.value;
  const completedFiles = importProgressCompletedFiles.value;
  const failedFiles = importProgressFailedFiles.value;

  if (importProgressStatus.value === 'failed') {
    importProgressLabel.value = job.errorMessage
      ? `Orthanc import failed: ${job.errorMessage}`
      : 'Orthanc import failed.';
    return;
  }

  if (importProgressStatus.value === 'completed') {
    importProgressLabel.value = failedFiles > 0
      ? `Imported ${completedFiles} of ${totalFiles} file${totalFiles === 1 ? '' : 's'} into Orthanc with ${failedFiles} skipped.`
      : `Imported ${completedFiles} of ${totalFiles} file${totalFiles === 1 ? '' : 's'} into Orthanc.`;
    return;
  }

  if (importProgressStatus.value === 'queued') {
    importProgressLabel.value = totalFiles > 0
      ? `Preparing Orthanc import for ${totalFiles} file${totalFiles === 1 ? '' : 's'}...`
      : 'Preparing Orthanc import...';
    return;
  }

  importProgressLabel.value = totalFiles > 0
    ? `Importing into Orthanc... ${completedFiles} / ${totalFiles} file${totalFiles === 1 ? '' : 's'}`
    : 'Importing into Orthanc...';
}

async function pollImportProgress(jobId, pollToken) {
  try {
    const response = await fetch(
      `/api/viewer/import-progress?${new URLSearchParams({ jobId }).toString()}`,
    );

    if (!response.ok) {
      throw new Error('Unable to read import progress');
    }

    const job = await response.json();
    if (pollToken !== importProgressPollToken) {
      return;
    }

    syncImportProgressFromJob(job);

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') {
      importProgressPollTimer = null;
      return;
    }

    importProgressPollTimer = window.setTimeout(() => {
      void pollImportProgress(jobId, pollToken);
    }, 400);
  } catch (_error) {
    if (pollToken !== importProgressPollToken) {
      return;
    }

    importProgressPollTimer = window.setTimeout(() => {
      void pollImportProgress(jobId, pollToken);
    }, 800);
  }
}

function waitForImportCompletion(jobId, pollToken) {
  return new Promise((resolve, reject) => {
    async function runPoll() {
      try {
        const response = await fetch(
          `/api/viewer/import-progress?${new URLSearchParams({ jobId }).toString()}`,
        );

        if (!response.ok) {
          throw new Error('Unable to read import progress');
        }

        const job = await response.json();
        if (pollToken !== importProgressPollToken) {
          return;
        }

        syncImportProgressFromJob(job);

        if (job.status === 'completed') {
          importProgressPollTimer = null;
          resolve(job);
          return;
        }

        if (job.status === 'failed' || job.status === 'canceled') {
          importProgressPollTimer = null;
          reject(new Error(job.errorMessage || 'Import failed'));
          return;
        }

        importProgressPollTimer = window.setTimeout(() => {
          void runPoll();
        }, 400);
      } catch (error) {
        if (pollToken !== importProgressPollToken) {
          return;
        }

        importProgressPollTimer = window.setTimeout(() => {
          void runPoll();
        }, 800);
      }
    }

    void runPoll();
  });
}

function startImportProgressPolling(jobId) {
  if (!jobId) {
    return Promise.resolve(null);
  }

  if (importProgressPollTimer) {
    window.clearTimeout(importProgressPollTimer);
    importProgressPollTimer = null;
  }
  if (importProgressResetTimer) {
    window.clearTimeout(importProgressResetTimer);
    importProgressResetTimer = null;
  }

  importJobId.value = String(jobId);
  importProgressPollToken += 1;
  const nextToken = importProgressPollToken;
  return waitForImportCompletion(importJobId.value, nextToken);
}

function resetUploadProgressState() {
  if (uploadProgressResetTimer) {
    window.clearTimeout(uploadProgressResetTimer);
    uploadProgressResetTimer = null;
  }

  uploadProgressStatus.value = 'idle';
  uploadProgressPercent.value = 0;
  uploadProgressLabel.value = '';
  uploadProgressDetail.value = '';
}

function updateUploadProgress({
  status = uploadProgressStatus.value || 'running',
  percent = uploadProgressPercent.value,
  label = uploadProgressLabel.value,
  detail = uploadProgressDetail.value,
} = {}) {
  if (uploadProgressResetTimer) {
    window.clearTimeout(uploadProgressResetTimer);
    uploadProgressResetTimer = null;
  }

  uploadProgressStatus.value = status;
  uploadProgressPercent.value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  uploadProgressLabel.value = label;
  uploadProgressDetail.value = detail;
}

function scheduleUploadProgressReset(delayMs = 3000) {
  if (uploadProgressResetTimer) {
    window.clearTimeout(uploadProgressResetTimer);
  }

  uploadProgressResetTimer = window.setTimeout(() => {
    uploadProgressResetTimer = null;
    resetUploadProgressState();
  }, delayMs);
}

function scheduleImportProgressReset(delayMs = 4000) {
  if (importProgressResetTimer) {
    window.clearTimeout(importProgressResetTimer);
  }

  importProgressResetTimer = window.setTimeout(() => {
    importProgressResetTimer = null;
    resetImportProgressState();
  }, delayMs);
}

const {
  currentPortalPage,
  isSidebarCollapsed,
  isSidebarOpen,
  viewportWidth,
  portalNavigationItems,
  currentPortalPageLabel,
  sidebarStatusMessage,
  showSidebarOverlay,
  syncPortalPageFromHash,
  syncSidebarMode,
  toggleSidebar,
  closeSidebarOnMobile,
  navigateToPortalPage,
  scrollToDatasetsArea,
} = usePortalNavigation({
  summary,
  analysisSessionId,
  currentPath,
  recentActiveSession,
  hasSavedDatasets: computed(() => availableDatasetRegistry.value.length > 0),
  folderSearchInputRef,
  showToast,
  loadRecentActiveSession,
  restoreSessionFromUrl,
});

const {
  viewerMode,
  viewerUrl,
  viewerModeTitle,
  viewerModeHint,
  viewerActionLabel,
  getViewerLaunchMessage,
  closeViewer,
  buildViewerUrl,
  openDashboardViewerLink,
} = useViewerFlow({
  navigateToPortalPage,
  showToast,
});

const ignoredFileExtensions = computed(() => (
  Object.entries(ignoredFileSummary.value?.countsByExtension || {})
    .map(([extension, count]) => ({ extension, count }))
    .sort((left, right) => right.count - left.count)
));

const paginatedWorkspaceDatasets = ref([]);
const paginatedWorkspaceManagementDatasets = ref([]);
const datasetSelectorControls = ref({
  page: 1,
  pageSize: Number(datasetSelectorPageSize.value),
  totalResults: 0,
  totalPages: 1,
});
const workspaceDatasetControls = ref({
  page: 1,
  pageSize: Number(workspaceDatasetPageSize.value),
  totalResults: 0,
  totalPages: 1,
});

async function refreshDatasetRegistrySnapshot() {
  try {
    clearLegacyBrowserDatasetRegistry();
    await loadDatasetRegistry();
    const summaryPayload = await loadDatasetRegistryWorkspaceSummary();
    workspaceGuardrail.value = summaryPayload?.workspace || null;
  } catch (error) {
    console.error(error);
    showActionError('Saved Datasets', 'Unable to refresh the saved dataset registry.');
  }
}

async function refreshDatasetSelectorPage() {
  try {
    const payload = await loadDatasetRegistryPage({
      page: datasetSelectorPage.value,
      pageSize: Number(datasetSelectorPageSize.value),
      search: datasetListSearchInput.value,
      sort: datasetListSortMode.value,
      status: 'available',
    });

    paginatedWorkspaceDatasets.value = (payload.items || []).filter(
      (dataset) => dataset?.status?.sessionAvailable !== false,
    );
    datasetSelectorControls.value = payload.controls || {
      page: 1,
      pageSize: Number(datasetSelectorPageSize.value),
      totalResults: 0,
      totalPages: 1,
    };
  } catch (error) {
    console.error(error);
    paginatedWorkspaceDatasets.value = [];
    datasetSelectorControls.value = {
      page: 1,
      pageSize: Number(datasetSelectorPageSize.value),
      totalResults: 0,
      totalPages: 1,
    };
    showActionError('Saved Datasets', 'Unable to load the dataset selector list.');
  }
}

async function refreshWorkspaceDatasetManagementPage() {
  try {
    const payload = await loadDatasetRegistryPage({
      page: workspaceDatasetPage.value,
      pageSize: Number(workspaceDatasetPageSize.value),
      search: datasetListSearchInput.value,
      sort: datasetListSortMode.value,
      status: 'all',
    });

    paginatedWorkspaceManagementDatasets.value = payload.items || [];
    workspaceDatasetControls.value = payload.controls || {
      page: 1,
      pageSize: Number(workspaceDatasetPageSize.value),
      totalResults: 0,
      totalPages: 1,
    };
  } catch (error) {
    console.error(error);
    paginatedWorkspaceManagementDatasets.value = [];
    workspaceDatasetControls.value = {
      page: 1,
      pageSize: Number(workspaceDatasetPageSize.value),
      totalResults: 0,
      totalPages: 1,
    };
    showActionError('Saved Datasets', 'Unable to load the workspace dataset list.');
  }
}

const dashboardRecentSessionText = computed(() => {
  if (summary.value) {
    return `${summary.value.dicomFiles} DICOM file${summary.value.dicomFiles === 1 ? '' : 's'} across ${summary.value.folderCount} folder${summary.value.folderCount === 1 ? '' : 's'}.`;
  }

  if (recentActiveSession.value) {
    return `Recent browser session saved at ${recentActiveSession.value.currentPath || 'Root'}.`;
  }

  return 'Upload a folder to create your first local workspace session.';
});

const dashboardCurrentLocation = computed(() => {
  if (summary.value) {
    return currentPath.value || 'Root';
  }

  if (recentActiveSession.value?.currentPath) {
    return recentActiveSession.value.currentPath;
  }

  return 'Not available';
});

const dashboardRecentDatasets = computed(() => (
  [...datasetRegistry.value]
    .sort((left, right) => (
      String(right.lastOpenedAt || right.updatedAt || right.createdAt || '').localeCompare(
        String(left.lastOpenedAt || left.updatedAt || left.createdAt || ''),
      )
    ))
    .slice(0, 4)
));

const lastOpenedSelection = computed(() => openedViewerSelections.value[0] || null);
const analyticsActivityEntries = computed(() => activityLog.value.slice(0, 8));

watch(currentPath, (value) => {
  if (!activeDataset.value) {
    return;
  }

  void updateActiveDataset({
    currentPath: value || '',
    lastOpenedAt: new Date().toISOString(),
  });
});

watch([datasetListSearchInput, datasetListSortMode], () => {
  datasetSelectorPage.value = 1;
  datasetSelectorPageInput.value = '1';
  datasetSelectorPageError.value = '';
  workspaceDatasetPage.value = 1;
  workspaceDatasetPageInput.value = '1';
  workspaceDatasetPageError.value = '';
  void refreshDatasetSelectorPage();
  void refreshWorkspaceDatasetManagementPage();
});

watch(datasetSelectorPageSize, () => {
  datasetSelectorPage.value = 1;
  datasetSelectorPageInput.value = '1';
  datasetSelectorPageError.value = '';
  void refreshDatasetSelectorPage();
});

watch(workspaceDatasetPageSize, () => {
  workspaceDatasetPage.value = 1;
  workspaceDatasetPageInput.value = '1';
  workspaceDatasetPageError.value = '';
  void refreshWorkspaceDatasetManagementPage();
});

watch(datasetSelectorPage, () => {
  void refreshDatasetSelectorPage();
});

watch(workspaceDatasetPage, () => {
  void refreshWorkspaceDatasetManagementPage();
});

watch(
  () => datasetSelectorControls.value.page,
  (value) => {
    datasetSelectorPageInput.value = String(value || 1);
  },
);

watch(
  () => workspaceDatasetControls.value.page,
  (value) => {
    workspaceDatasetPageInput.value = String(value || 1);
  },
);

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
}

async function openDatasetDetailPage(datasetId) {
  let dataset = findDatasetById(datasetId);
  if (!dataset) {
    await refreshDatasetRegistrySnapshot();
    dataset = findDatasetById(datasetId);
  }

  if (!dataset) {
    selectedDatasetDetailId.value = '';
    showActionError('Dataset Detail', 'The selected dataset is no longer available.');
    navigateToPortalPage('workspace-datasets');
    return;
  }

  selectedDatasetDetailId.value = dataset.id;
  navigateToPortalPage('dataset-detail');
}

function openUploadGuideModal() {
  if (analyzing.value) {
    return;
  }

  void (async () => {
    await refreshDatasetRegistrySnapshot();
    const shouldContinue = await confirmLargeWorkspaceUpload();
    if (!shouldContinue) {
      return;
    }

    showUploadGuideModal.value = true;
  })();
}

function closeUploadGuideModal() {
  showUploadGuideModal.value = false;
}

function chooseDuplicateUploadResolution(action) {
  if (duplicateUploadResolver) {
    duplicateUploadResolver(action);
    duplicateUploadResolver = null;
  }

  duplicateUploadConflict.value = null;
}

function promptForDuplicateUploadResolution(conflict) {
  duplicateUploadConflict.value = conflict;

  return new Promise((resolve) => {
    duplicateUploadResolver = resolve;
  });
}

function resolveSaveChoicePrompt(choice) {
  if (saveChoiceResolver) {
    saveChoiceResolver(choice);
    saveChoiceResolver = null;
  }

  saveChoicePrompt.value = null;
}

function cancelSaveChoicePrompt() {
  if (saveChoiceResolver) {
    saveChoiceResolver('');
    saveChoiceResolver = null;
  }

  saveChoicePrompt.value = null;
}

function promptForSaveChoice(config) {
  saveChoicePrompt.value = config;

  return new Promise((resolve) => {
    saveChoiceResolver = resolve;
  });
}

function resolveWorkspaceGuardrailPrompt(choice) {
  if (workspaceGuardrailResolver) {
    workspaceGuardrailResolver(choice);
    workspaceGuardrailResolver = null;
  }

  workspaceGuardrailPrompt.value = null;
}

function cancelWorkspaceGuardrailPrompt() {
  if (workspaceGuardrailResolver) {
    workspaceGuardrailResolver('');
    workspaceGuardrailResolver = null;
  }

  workspaceGuardrailPrompt.value = null;
}

function promptForWorkspaceGuardrail(config) {
  workspaceGuardrailPrompt.value = config;

  return new Promise((resolve) => {
    workspaceGuardrailResolver = resolve;
  });
}

function getWorkspaceGuardrailToken() {
  if (!workspaceGuardrail.value) {
    return '';
  }

  return `${workspaceGuardrail.value.level}:${workspaceGuardrail.value.totalDatasets}`;
}

async function confirmLargeWorkspaceUpload() {
  if (!workspaceGuardrail.value || workspaceGuardrail.value.level === 'normal') {
    return true;
  }

  const guardrailToken = getWorkspaceGuardrailToken();
  if (guardrailToken && workspaceGuardrailAcknowledgedToken === guardrailToken) {
    return true;
  }

  const choice = await promptForWorkspaceGuardrail({
    title: workspaceGuardrail.value.level === 'elevated'
      ? 'This workspace already has many saved datasets'
      : 'This workspace is getting large',
    message: `${workspaceGuardrail.value.message} The backend registry remains the source of truth and the browser still keeps only lightweight helper state. Continue with this upload?`,
    options: [
      {
        value: 'continue',
        label: 'Continue Upload',
        description: 'Proceed and create another saved dataset in this local workspace.',
        recommended: true,
      },
      {
        value: 'review',
        label: 'Review Workspace',
        description: 'Open Workspace Datasets first to review or clean up saved datasets before uploading more.',
      },
    ],
  });

  if (choice === 'review') {
    navigateToPortalPage('workspace-datasets');
    showActionInfo('Workspace Guardrail', 'Review the saved dataset workspace before creating another dataset.');
    return false;
  }

  if (choice === 'continue') {
    workspaceGuardrailAcknowledgedToken = guardrailToken;
  }

  return choice === 'continue';
}

function continueToFolderPicker() {
  closeUploadGuideModal();
  folderInput.value?.click();
}

function dismissRecentUploadSuccess() {
  recentUploadSuccess.value = null;
}

function persistRecentActiveSession(state = captureNavigationState()) {
  const queryState = buildQueryStateFromNavigation(state);
  if (!queryState.sessionId) {
    clearRecentActiveSession();
    return;
  }

  const nextValue = {
    ...queryState,
    savedAt: new Date().toISOString(),
  };
  window.sessionStorage.setItem(RECENT_ACTIVE_SESSION_KEY, JSON.stringify(nextValue));
  recentActiveSession.value = nextValue;
}

function loadRecentActiveSession() {
  try {
    const rawValue = window.sessionStorage.getItem(RECENT_ACTIVE_SESSION_KEY);
    recentActiveSession.value = rawValue ? JSON.parse(rawValue) : null;
  } catch (_error) {
    recentActiveSession.value = null;
  }
}

function clearRecentActiveSession() {
  window.sessionStorage.removeItem(RECENT_ACTIVE_SESSION_KEY);
  recentActiveSession.value = null;
}

function hasCurrentSessionScopedBrowserState() {
  return Boolean(
    recentLocations.value.length
    || openedViewerSelections.value.length
    || activityLog.value.length
    || usageIndicators.value
    || recentActiveSession.value?.sessionId === analysisSessionId.value,
  );
}

function shouldWarnBeforeUnload() {
  if (!analysisSessionId.value) {
    return false;
  }

  const savedDataset = findDatasetBySessionId(analysisSessionId.value);

  return Boolean(
    analyzing.value
    || importing.value
    || exporting.value
    || summaryExporting.value
    || currentFolderLoading.value
    || !savedDataset
    || hasCurrentSessionScopedBrowserState(),
  );
}

function handleBeforeUnload(event) {
  if (!shouldWarnBeforeUnload()) {
    return;
  }

  // Browsers ignore custom text here, but setting returnValue still triggers
  // the native close warning when unload-sensitive workspace state exists.
  event.preventDefault();
  event.returnValue = '';
}

function getOpenedSelectionsStorageKey(sessionId) {
  return `dicom-local-viewer:opened-selections:${sessionId}`;
}

function getActivityLogStorageKey(sessionId) {
  return `dicom-local-viewer:activity-log:${sessionId}`;
}

function getUsageIndicatorsStorageKey(sessionId) {
  return `dicom-local-viewer:usage-indicators:${sessionId}`;
}

function loadOpenedSelectionsForSession(sessionId) {
  if (!sessionId) {
    openedViewerSelections.value = [];
    return;
  }

  try {
    const rawValue = window.sessionStorage.getItem(getOpenedSelectionsStorageKey(sessionId));
    openedViewerSelections.value = rawValue ? JSON.parse(rawValue) : [];
  } catch (_error) {
    openedViewerSelections.value = [];
  }
}

function persistOpenedSelectionsForSession(sessionId = analysisSessionId.value) {
  if (!sessionId) {
    return;
  }

  window.sessionStorage.setItem(
    getOpenedSelectionsStorageKey(sessionId),
    JSON.stringify(openedViewerSelections.value),
  );
}

function clearOpenedSelectionsForSession(sessionId = analysisSessionId.value) {
  if (!sessionId) {
    openedViewerSelections.value = [];
    return;
  }

  window.sessionStorage.removeItem(getOpenedSelectionsStorageKey(sessionId));
  if (sessionId === analysisSessionId.value) {
    openedViewerSelections.value = [];
  }
}

function loadActivityLogForSession(sessionId) {
  if (!sessionId) {
    activityLog.value = [];
    return;
  }

  try {
    const rawValue = window.sessionStorage.getItem(getActivityLogStorageKey(sessionId));
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    activityLog.value = Array.isArray(parsedValue) ? parsedValue.slice(0, MAX_ACTIVITY_LOG_ENTRIES) : [];
  } catch (_error) {
    activityLog.value = [];
  }
}

function persistActivityLogForSession(sessionId = analysisSessionId.value) {
  if (!sessionId) {
    return;
  }

  window.sessionStorage.setItem(
    getActivityLogStorageKey(sessionId),
    JSON.stringify(activityLog.value),
  );
}

function clearActivityLogForSession(sessionId = analysisSessionId.value) {
  if (!sessionId) {
    activityLog.value = [];
    return;
  }

  window.sessionStorage.removeItem(getActivityLogStorageKey(sessionId));
  if (sessionId === analysisSessionId.value) {
    activityLog.value = [];
  }
}

function loadUsageIndicatorsForSession(sessionId) {
  if (!sessionId) {
    usageIndicators.value = null;
    return;
  }

  try {
    const rawValue = window.sessionStorage.getItem(getUsageIndicatorsStorageKey(sessionId));
    usageIndicators.value = rawValue ? JSON.parse(rawValue) : null;
  } catch (_error) {
    usageIndicators.value = null;
  }
}

function persistUsageIndicatorsForSession(sessionId = analysisSessionId.value) {
  if (!sessionId) {
    return;
  }

  if (!usageIndicators.value) {
    window.sessionStorage.removeItem(getUsageIndicatorsStorageKey(sessionId));
    return;
  }

  window.sessionStorage.setItem(
    getUsageIndicatorsStorageKey(sessionId),
    JSON.stringify(usageIndicators.value),
  );
}

function clearUsageIndicatorsForSession(sessionId = analysisSessionId.value) {
  if (!sessionId) {
    usageIndicators.value = null;
    return;
  }

  window.sessionStorage.removeItem(getUsageIndicatorsStorageKey(sessionId));
  if (sessionId === analysisSessionId.value) {
    usageIndicators.value = null;
  }
}

function addActivityLog(title, message) {
  activityLog.value = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      timestamp: new Date().toISOString(),
    },
    ...activityLog.value,
  ].slice(0, MAX_ACTIVITY_LOG_ENTRIES);
  persistActivityLogForSession();
}

function clearActivityLog() {
  clearActivityLogForSession();
}

function goToDatasetSelectorPage(page) {
  const safePage = Math.min(
    Math.max(1, Number(page) || 1),
    datasetSelectorControls.value.totalPages,
  );
  datasetSelectorPage.value = safePage;
  datasetSelectorPageInput.value = String(safePage);
  datasetSelectorPageError.value = '';
}

function submitDatasetSelectorPage() {
  const requestedPage = Number(datasetSelectorPageInput.value);
  if (!Number.isInteger(requestedPage)
    || requestedPage < 1
    || requestedPage > datasetSelectorControls.value.totalPages) {
    datasetSelectorPageError.value = `Enter a page from 1 to ${datasetSelectorControls.value.totalPages}.`;
    return;
  }

  goToDatasetSelectorPage(requestedPage);
}

function goToWorkspaceDatasetPage(page) {
  const safePage = Math.min(
    Math.max(1, Number(page) || 1),
    workspaceDatasetControls.value.totalPages,
  );
  workspaceDatasetPage.value = safePage;
  workspaceDatasetPageInput.value = String(safePage);
  workspaceDatasetPageError.value = '';
}

function submitWorkspaceDatasetPage() {
  const requestedPage = Number(workspaceDatasetPageInput.value);
  if (!Number.isInteger(requestedPage)
    || requestedPage < 1
    || requestedPage > workspaceDatasetControls.value.totalPages) {
    workspaceDatasetPageError.value = `Enter a page from 1 to ${workspaceDatasetControls.value.totalPages}.`;
    return;
  }

  goToWorkspaceDatasetPage(requestedPage);
}

function toggleWorkspaceDatasetExpansion(datasetId) {
  expandedWorkspaceDatasetId.value = expandedWorkspaceDatasetId.value === datasetId
    ? ''
    : datasetId;
}

function formatActivityTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function confirmLargeSelection(relativePaths, contextLabel = 'this selection') {
  const fileCount = Array.isArray(relativePaths) ? relativePaths.length : 0;
  if (fileCount < LARGE_SELECTION_WARNING_THRESHOLD) {
    return true;
  }

  const warningLevel = fileCount >= VERY_LARGE_SELECTION_WARNING_THRESHOLD
    ? 'very large'
    : 'large';
  const message = [
    `You are about to open a ${warningLevel} DICOM selection in OHIF.`,
    '',
    `Selection: ${contextLabel}`,
    `File count: ${fileCount}`,
    '',
    'Large imports can take longer and may use more local memory in your browser and local stack.',
    'Do you want to continue?',
  ].join('\n');

  return window.confirm(message);
}

function formatFileSize(size) {
  const numericSize = Number(size) || 0;

  if (numericSize < 1024) {
    return `${numericSize} B`;
  }

  if (numericSize < 1024 * 1024) {
    return `${(numericSize / 1024).toFixed(1)} KB`;
  }

  return `${(numericSize / (1024 * 1024)).toFixed(1)} MB`;
}

function formatParentPath(path) {
  return path || 'Root';
}

function summarizeMetadataValue(value, count, pluralLabel) {
  if (value) {
    return value;
  }

  if (count && count > 1) {
    return `${count} ${pluralLabel}`;
  }

  return 'Unavailable';
}

async function copyTextToClipboard(value) {
  if (!value) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', 'true');
  textArea.style.position = 'absolute';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();

  try {
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch (_error) {
    document.body.removeChild(textArea);
    return false;
  }
}

async function copyInspectorValue(label, value) {
  if (!value) {
    showActionError('Copy', `${label} is not available to copy.`);
    return;
  }

  try {
    const copied = await copyTextToClipboard(value);
    if (!copied) {
      throw new Error('Copy command was not available');
    }

    showActionSuccess('Copy', `${label} was copied to the clipboard.`);
  } catch (error) {
    console.error(error);
    showActionError('Copy', `Unable to copy ${label}.`);
  }
}

function inferFilenameExtension(filename, mimeType = '') {
  const loweredName = String(filename || '').toLowerCase();
  if (loweredName.endsWith('.json')) return '.json';
  if (loweredName.endsWith('.txt')) return '.txt';
  if (loweredName.endsWith('.tar')) return '.tar';
  if (loweredName.endsWith('.dcm')) return '.dcm';
  if (mimeType.includes('json')) return '.json';
  if (mimeType.includes('text/plain')) return '.txt';
  if (mimeType.includes('application/x-tar')) return '.tar';
  if (mimeType.includes('application/dicom')) return '.dcm';
  return '';
}

function buildPickerTypes(filename, mimeType = '') {
  const extension = inferFilenameExtension(filename, mimeType);
  if (!extension) {
    return [];
  }

  const resolvedMimeType = mimeType || 'application/octet-stream';
  return [{
    description: 'DICOM Local Viewer export',
    accept: {
      [resolvedMimeType]: [extension],
    },
  }];
}

async function saveBlobLocally(blob, filename, mimeType = '') {
  const suggestedName = filename || 'dicom-selection';

  if (typeof window.showSaveFilePicker === 'function') {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: buildPickerTypes(suggestedName, mimeType),
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }

  triggerBrowserDownload(blob, suggestedName);
  return true;
}

function formatIsoTimestamp(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function buildSuggestedSummaryName(format) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `dicom-session-summary-${stamp}.${format === 'text' ? 'txt' : 'json'}`;
}

function recordOpenedSelection(entry) {
  const nextEntry = {
    openedAt: new Date().toISOString(),
    ...entry,
  };

  openedViewerSelections.value = [
    nextEntry,
    ...openedViewerSelections.value,
  ].slice(0, MAX_OPENED_SELECTIONS);
  persistOpenedSelectionsForSession();
}

async function fetchSessionMetadataSummary() {
  if (!analysisSessionId.value) {
    return null;
  }

  try {
    const searchParams = new URLSearchParams({
      sessionId: analysisSessionId.value,
      itemType: 'folder',
      path: '',
    });
    const response = await fetch(`/api/viewer/metadata-summary?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error('Unable to load session metadata summary');
    }

    const payload = await response.json();
    return payload.metadata || null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function refreshUsageIndicators(options = {}) {
  const { showFeedback = false } = options;
  if (!analysisSessionId.value) {
    usageIndicators.value = null;
    return;
  }

  usageLoading.value = true;

  try {
    const response = await fetch(
      `/api/viewer/usage?${new URLSearchParams({ sessionId: analysisSessionId.value }).toString()}`,
    );
    if (!response.ok) {
      throw new Error('Unable to load usage indicators');
    }

    usageIndicators.value = await response.json();
    persistUsageIndicatorsForSession();
    if (showFeedback) {
      showActionSuccess('Usage Refresh', 'Local usage indicators were updated.');
    }
  } catch (error) {
    console.error(error);
    if (showFeedback) {
      showActionError('Usage Refresh', 'Unable to refresh local usage indicators.');
    }
  } finally {
    usageLoading.value = false;
  }
}

async function buildSessionSummaryPayload() {
  const sessionMetadata = await fetchSessionMetadataSummary();

  return {
    generatedAt: new Date().toISOString(),
    sessionId: analysisSessionId.value,
    selectedLocation: {
      label: currentNode.value?.label || 'Root',
      path: currentPath.value || 'Root',
      dicomCount: currentNode.value?.dicomCount || 0,
      folderCount: currentNode.value?.children?.length || 0,
      directFileCount: currentNode.value?.files?.length || 0,
    },
    sessionTotals: {
      selectedFiles: summary.value?.totalFiles || 0,
      dicomFiles: summary.value?.dicomFiles || 0,
      folderCount: summary.value?.folderCount || 0,
      studyCount: sessionMetadata?.studyCount || (sessionMetadata?.studyInstanceUid ? 1 : 0),
      seriesCount: sessionMetadata?.seriesCount || (sessionMetadata?.seriesInstanceUid ? 1 : 0),
      modalityCount: sessionMetadata?.modalityCount || (sessionMetadata?.modality ? 1 : 0),
    },
    currentFolder: {
      path: currentPath.value || '',
      controls: {
        search: folderSearchInput.value,
        searchScope: currentFolderSearchScope.value,
        extension: currentFolderExtensionFilter.value,
        sizeRange: currentFolderSizeRange.value,
        sortBy: currentFolderSortBy.value,
        sortDir: currentFolderSortDir.value,
        pageSize: currentFolderPageSize.value,
        page: currentFolderControls.value.page,
        totalResults: currentFolderControls.value.totalResults || 0,
      },
    },
    ignoredFiles: ignoredFileSummary.value || null,
    recentLocations: recentLocations.value.map((location) => ({
      label: location.label,
      path: location.path || '',
    })),
    openedItems: openedViewerSelections.value,
    preferences: {
      theme: theme.value,
      viewerMode: viewerMode.value,
      currentFolderViewMode: currentFolderViewMode.value,
    },
  };
}

function buildSessionSummaryText(summaryPayload) {
  const lines = [
    'DICOM Local Viewer Session Summary',
    `Generated: ${formatIsoTimestamp(summaryPayload.generatedAt)}`,
    `Session ID: ${summaryPayload.sessionId}`,
    '',
    `Selected Location: ${summaryPayload.selectedLocation.label}`,
    `Selected Path: ${summaryPayload.selectedLocation.path}`,
    `Selected DICOM Count: ${summaryPayload.selectedLocation.dicomCount}`,
    `Selected Subfolders: ${summaryPayload.selectedLocation.folderCount}`,
    `Selected Direct Files: ${summaryPayload.selectedLocation.directFileCount}`,
    '',
    `Total Uploaded Files: ${summaryPayload.sessionTotals.selectedFiles}`,
    `Total DICOM Files: ${summaryPayload.sessionTotals.dicomFiles}`,
    `Total Folders: ${summaryPayload.sessionTotals.folderCount}`,
    `Studies: ${summaryPayload.sessionTotals.studyCount}`,
    `Series: ${summaryPayload.sessionTotals.seriesCount}`,
    `Modalities: ${summaryPayload.sessionTotals.modalityCount}`,
    '',
    `Viewer Mode: ${summaryPayload.preferences.viewerMode}`,
    `Theme: ${summaryPayload.preferences.theme}`,
    `Current Folder View: ${summaryPayload.preferences.currentFolderViewMode}`,
    '',
    `Search: ${summaryPayload.currentFolder.controls.search || '(none)'}`,
    `Search Scope: ${summaryPayload.currentFolder.controls.searchScope}`,
    `Type Filter: ${summaryPayload.currentFolder.controls.extension}`,
    `Size Filter: ${summaryPayload.currentFolder.controls.sizeRange}`,
    `Sort: ${summaryPayload.currentFolder.controls.sortBy} ${summaryPayload.currentFolder.controls.sortDir}`,
    `Results/Page: ${summaryPayload.currentFolder.controls.pageSize}`,
    `Current Result Count: ${summaryPayload.currentFolder.controls.totalResults}`,
    '',
    `Ignored Non-DICOM Files: ${summaryPayload.ignoredFiles?.ignoredFileCount || 0}`,
    '',
    'Opened Items:',
  ];

  if (summaryPayload.openedItems.length === 0) {
    lines.push('  None');
  } else {
    summaryPayload.openedItems.forEach((item) => {
      lines.push(`  - ${formatIsoTimestamp(item.openedAt)} | ${item.label} | ${item.fileCount} file(s) | ${item.studyCount} stud${item.studyCount === 1 ? 'y' : 'ies'}`);
    });
  }

  return lines.join('\n');
}

async function exportSessionSummary(format = 'json') {
  if (!analysisSessionId.value) {
    showActionError('Export', 'No active session is available to export.');
    return;
  }

  summaryExporting.value = true;

  try {
    const summaryPayload = await buildSessionSummaryPayload();
    const isText = format === 'text';
    const blob = new Blob(
      [isText ? buildSessionSummaryText(summaryPayload) : JSON.stringify(summaryPayload, null, 2)],
      { type: isText ? 'text/plain' : 'application/json' },
    );
    await saveBlobLocally(
      blob,
      buildSuggestedSummaryName(format),
      isText ? 'text/plain' : 'application/json',
    );
    showActionSuccess('Export', `The session summary was saved locally as ${isText ? 'text' : 'JSON'}.`);
    addActivityLog(
      'Summary Exported',
      `Saved the local session summary as ${isText ? 'text' : 'JSON'}.`,
    );
  } catch (error) {
    if (error?.name === 'AbortError') {
      showActionInfo('Export', 'Local summary export was canceled.');
    } else {
      console.error(error);
      showActionError('Export', 'Unable to export the session summary.');
    }
  } finally {
    summaryExporting.value = false;
  }
}

function selectInspectorItem(item) {
  if (!item) {
    selectedInspectorItem.value = null;
    return;
  }

  if (item.type === 'folder') {
    selectedInspectorItem.value = {
      type: 'folder',
      displayName: item.label || item.name || 'Root',
      path: item.path || '',
      pathDisplay: item.path || 'Root',
      dicomCount: item.dicomCount || 0,
      folderCount: item.folderCount || 0,
    };
    return;
  }

  selectedInspectorItem.value = {
    type: 'file',
    displayName: item.fileName || item.name,
    relativePath: item.relativePath,
    targetPath: item.targetPath || item.relativePath.split('/').slice(0, -1).join('/'),
    pathDisplay: item.relativePath,
    size: item.size || 0,
  };
}

function clearInspectorSelection() {
  selectedInspectorItem.value = null;
}

function inspectAndSelectFolder(item) {
  if (!item) {
    return;
  }

  jumpToBreadcrumbPath(item.path || '');
}

async function loadInspectorMetadata(item) {
  inspectorMetadataRequestId += 1;
  const requestId = inspectorMetadataRequestId;

  if (!item || !analysisSessionId.value) {
    inspectorMetadataSummary.value = null;
    inspectorMetadataError.value = '';
    inspectorMetadataLoading.value = false;
    return;
  }

  inspectorMetadataLoading.value = true;
  inspectorMetadataSummary.value = null;
  inspectorMetadataError.value = '';

  try {
    const searchParams = new URLSearchParams({
      sessionId: analysisSessionId.value,
      itemType: item.type,
      path: item.type === 'file' ? item.relativePath : item.path || '',
    });

    const response = await fetch(`/api/viewer/metadata-summary?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error('Unable to load DICOM metadata summary for this selection.');
    }

    const payload = await response.json();
    if (requestId !== inspectorMetadataRequestId) {
      return;
    }

    inspectorMetadataSummary.value = payload.metadata || null;
  } catch (error) {
    if (requestId !== inspectorMetadataRequestId) {
      return;
    }

    console.error(error);
    inspectorMetadataError.value = 'Unable to load DICOM metadata summary for this selection.';
  } finally {
    if (requestId === inspectorMetadataRequestId) {
      inspectorMetadataLoading.value = false;
    }
  }
}

function goToInspectorParentFolder() {
  const targetPath = selectedInspectorItem.value?.targetPath || '';

  if (targetPath === currentPath.value) {
    showActionInfo('Navigation', 'You are already viewing the parent folder for this file.');
    return;
  }

  jumpToBreadcrumbPath(targetPath);
}

function getRecentLocationsStorageKey(sessionId) {
  return `dicom-local-viewer:recent-locations:${sessionId}`;
}

function formatLocationLabel(path) {
  if (!path) {
    return 'Root';
  }

  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) {
    return parts.join(' / ');
  }

  return `${parts[0]} / ... / ${parts[parts.length - 1]}`;
}

function buildRecentLocationEntry(path, state = captureNavigationState()) {
  const queryState = buildQueryStateFromNavigation({
    ...state,
    currentPath: path,
  });

  return {
    path: queryState.currentPath,
    label: formatLocationLabel(queryState.currentPath),
    search: queryState.search,
    sortBy: queryState.sortBy,
    sortDir: queryState.sortDir,
    pageSize: queryState.pageSize,
    page: queryState.page,
  };
}

function loadRecentLocationsForSession(sessionId) {
  if (!sessionId) {
    recentLocations.value = [];
    return;
  }

  try {
    const rawValue = window.sessionStorage.getItem(getRecentLocationsStorageKey(sessionId));
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    recentLocations.value = Array.isArray(parsedValue)
      ? parsedValue
        .filter((item) => typeof item?.path === 'string')
        .map((item) => buildRecentLocationEntry(item.path, item))
        .slice(0, MAX_RECENT_LOCATIONS)
      : [];
  } catch (_error) {
    recentLocations.value = [];
  }
}

function persistRecentLocations() {
  if (!analysisSessionId.value) {
    return;
  }

  window.sessionStorage.setItem(
    getRecentLocationsStorageKey(analysisSessionId.value),
    JSON.stringify(recentLocations.value),
  );
}

function clearRecentLocationsForSession(sessionId) {
  if (!sessionId) {
    recentLocations.value = [];
    return;
  }

  window.sessionStorage.removeItem(getRecentLocationsStorageKey(sessionId));
  recentLocations.value = [];
}

function recordRecentLocation(path, state = captureNavigationState()) {
  if (!analysisSessionId.value || treeRoot.value === null) {
    return;
  }

  const nextEntry = buildRecentLocationEntry(path || '', state);
  recentLocations.value = [
    nextEntry,
    ...recentLocations.value.filter((item) => item.path !== nextEntry.path),
  ].slice(0, MAX_RECENT_LOCATIONS);
  persistRecentLocations();
}

function syncRecentLocationForCurrentState(overrides = {}) {
  if (!analysisSessionId.value || treeRoot.value === null) {
    return;
  }

  const nextEntry = buildRecentLocationEntry(currentPath.value, {
    ...captureNavigationState(),
    ...overrides,
  });
  const existingIndex = recentLocations.value.findIndex((item) => item.path === nextEntry.path);

  if (existingIndex === -1) {
    recordRecentLocation(nextEntry.path, nextEntry);
    return;
  }

  recentLocations.value = recentLocations.value.map((item, index) => (
    index === existingIndex ? nextEntry : item
  ));
  persistRecentLocations();
}

async function jumpToRecentLocation(location) {
  const targetState = buildQueryStateFromNavigation({
    sessionId: analysisSessionId.value,
    currentPath: location?.path || '',
    search: location?.search || '',
    searchScope: location?.searchScope || defaultCurrentFolderControls.searchScope,
    extension: location?.extension || defaultCurrentFolderControls.extension,
    sizeRange: location?.sizeRange || defaultCurrentFolderControls.sizeRange,
    sortBy: location?.sortBy || defaultCurrentFolderControls.sortBy,
    sortDir: location?.sortDir || defaultCurrentFolderControls.sortDir,
    pageSize: location?.pageSize || defaultCurrentFolderControls.pageSize,
    page: location?.page || 1,
  });

  isApplyingHistoryState.value = true;

  try {
    currentPath.value = targetState.currentPath;
    folderSearchInput.value = targetState.search;
    debouncedFolderSearch.value = targetState.search;
    currentFolderSearchScope.value = targetState.searchScope;
    currentFolderExtensionFilter.value = targetState.extension;
    currentFolderSizeRange.value = targetState.sizeRange;
    currentFolderSortBy.value = targetState.sortBy;
    currentFolderSortDir.value = targetState.sortDir;
    currentFolderPageSize.value = targetState.pageSize;
    currentFolderControls.value = {
      ...currentFolderControls.value,
      page: targetState.page,
    };

    await fetchCurrentFolderResults();
  } finally {
    isApplyingHistoryState.value = false;
  }

  recordRecentLocation(targetState.currentPath, targetState);
  syncHistoryState();
}

function captureNavigationState() {
  return {
    sessionId: analysisSessionId.value,
    currentPath: currentPath.value,
    search: folderSearchInput.value,
    searchScope: currentFolderSearchScope.value,
    extension: currentFolderExtensionFilter.value,
    sizeRange: currentFolderSizeRange.value,
    sortBy: currentFolderSortBy.value,
    sortDir: currentFolderSortDir.value,
    pageSize: currentFolderPageSize.value,
    page: currentFolderControls.value.page,
  };
}

function buildQueryStateFromNavigation(state = captureNavigationState()) {
  return {
    sessionId: state.sessionId || '',
    currentPath: state.currentPath || '',
    search: state.search || '',
    searchScope: state.searchScope === 'current' ? 'current' : defaultCurrentFolderControls.searchScope,
    extension: ['all', '.dcm', 'folders'].includes(String(state.extension))
      ? String(state.extension)
      : defaultCurrentFolderControls.extension,
    sizeRange: ['all', 'lt1mb', '1to10mb', 'gt10mb'].includes(String(state.sizeRange))
      ? String(state.sizeRange)
      : defaultCurrentFolderControls.sizeRange,
    sortBy: state.sortBy || defaultCurrentFolderControls.sortBy,
    sortDir: state.sortDir === 'desc' ? 'desc' : defaultCurrentFolderControls.sortDir,
    pageSize: ['25', '50', '100'].includes(String(state.pageSize))
      ? String(state.pageSize)
      : defaultCurrentFolderControls.pageSize,
    page: Math.max(Number(state.page) || 1, 1),
  };
}

function buildUrlForState(state = captureNavigationState()) {
  const queryState = buildQueryStateFromNavigation(state);
  const nextUrl = new URL(window.location.href);

  Object.values(QUERY_KEYS).forEach((key) => {
    nextUrl.searchParams.delete(key);
  });

  if (!queryState.sessionId) {
    return `${nextUrl.pathname}${nextUrl.hash}`;
  }

  nextUrl.searchParams.set(QUERY_KEYS.sessionId, queryState.sessionId);

  if (queryState.currentPath) {
    nextUrl.searchParams.set(QUERY_KEYS.currentPath, queryState.currentPath);
  }

  if (queryState.search) {
    nextUrl.searchParams.set(QUERY_KEYS.search, queryState.search);
  }

  if (queryState.searchScope !== defaultCurrentFolderControls.searchScope) {
    nextUrl.searchParams.set(QUERY_KEYS.searchScope, queryState.searchScope);
  }

  if (queryState.extension !== defaultCurrentFolderControls.extension) {
    nextUrl.searchParams.set(QUERY_KEYS.extension, queryState.extension);
  }

  if (queryState.sizeRange !== defaultCurrentFolderControls.sizeRange) {
    nextUrl.searchParams.set(QUERY_KEYS.sizeRange, queryState.sizeRange);
  }

  if (queryState.sortBy !== defaultCurrentFolderControls.sortBy) {
    nextUrl.searchParams.set(QUERY_KEYS.sortBy, queryState.sortBy);
  }

  if (queryState.sortDir !== defaultCurrentFolderControls.sortDir) {
    nextUrl.searchParams.set(QUERY_KEYS.sortDir, queryState.sortDir);
  }

  if (queryState.pageSize !== defaultCurrentFolderControls.pageSize) {
    nextUrl.searchParams.set(QUERY_KEYS.pageSize, queryState.pageSize);
  }

  if (queryState.page > 1) {
    nextUrl.searchParams.set(QUERY_KEYS.page, String(queryState.page));
  }

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}

function readNavigationStateFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    sessionId: searchParams.get(QUERY_KEYS.sessionId) || '',
    currentPath: searchParams.get(QUERY_KEYS.currentPath) || '',
    search: searchParams.get(QUERY_KEYS.search) || '',
    searchScope: searchParams.get(QUERY_KEYS.searchScope) === 'current' ? 'current' : defaultCurrentFolderControls.searchScope,
    extension: ['all', '.dcm', 'folders'].includes(searchParams.get(QUERY_KEYS.extension))
      ? searchParams.get(QUERY_KEYS.extension)
      : defaultCurrentFolderControls.extension,
    sizeRange: ['all', 'lt1mb', '1to10mb', 'gt10mb'].includes(searchParams.get(QUERY_KEYS.sizeRange))
      ? searchParams.get(QUERY_KEYS.sizeRange)
      : defaultCurrentFolderControls.sizeRange,
    sortBy: searchParams.get(QUERY_KEYS.sortBy) || defaultCurrentFolderControls.sortBy,
    sortDir: searchParams.get(QUERY_KEYS.sortDir) === 'desc' ? 'desc' : defaultCurrentFolderControls.sortDir,
    pageSize: ['25', '50', '100'].includes(searchParams.get(QUERY_KEYS.pageSize))
      ? searchParams.get(QUERY_KEYS.pageSize)
      : defaultCurrentFolderControls.pageSize,
    page: Math.max(Number(searchParams.get(QUERY_KEYS.page)) || 1, 1),
  };
}

function syncHistoryState(options = {}) {
  if (!historyStateEnabled || !analysisSessionId.value || isApplyingHistoryState.value) {
    return;
  }

  const navigationState = captureNavigationState();
  persistRecentActiveSession(navigationState);
  const nextState = {
    dicomLocalViewerState: navigationState,
  };
  const nextUrl = buildUrlForState(navigationState);

  if (options.replace) {
    window.history.replaceState(nextState, '', nextUrl);
    return;
  }

  window.history.pushState(nextState, '', nextUrl);
}

async function applyNavigationStateFromHistory(state) {
  if (!state || !state.sessionId || state.sessionId !== analysisSessionId.value) {
    return;
  }

  isApplyingHistoryState.value = true;

  try {
    currentPath.value = state.currentPath || '';
    folderSearchInput.value = state.search || '';
    debouncedFolderSearch.value = state.search || '';
    currentFolderSearchScope.value = state.searchScope === 'current' ? 'current' : defaultCurrentFolderControls.searchScope;
    currentFolderExtensionFilter.value = state.extension || defaultCurrentFolderControls.extension;
    currentFolderSizeRange.value = state.sizeRange || defaultCurrentFolderControls.sizeRange;
    currentFolderSortBy.value = state.sortBy || defaultCurrentFolderControls.sortBy;
    currentFolderSortDir.value = state.sortDir || defaultCurrentFolderControls.sortDir;
    currentFolderPageSize.value = state.pageSize || defaultCurrentFolderControls.pageSize;
    currentFolderControls.value = {
      ...currentFolderControls.value,
      page: state.page || 1,
    };

    await fetchCurrentFolderResults();
  } finally {
    isApplyingHistoryState.value = false;
  }
}

function handleBrowserNavigation(event) {
  const nextState = event.state?.dicomLocalViewerState || readNavigationStateFromUrl();
  void applyNavigationStateFromHistory(nextState);
}

onMounted(() => {
  historyStateEnabled = true;
  window.addEventListener('popstate', handleBrowserNavigation);
  window.addEventListener('beforeunload', handleBeforeUnload);
  void refreshDatasetRegistrySnapshot();
  void refreshDatasetSelectorPage();
  void refreshWorkspaceDatasetManagementPage();
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handleBrowserNavigation);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if (importProgressPollTimer) {
    window.clearTimeout(importProgressPollTimer);
    importProgressPollTimer = null;
  }
  if (importProgressResetTimer) {
    window.clearTimeout(importProgressResetTimer);
    importProgressResetTimer = null;
  }
  if (uploadProgressResetTimer) {
    window.clearTimeout(uploadProgressResetTimer);
    uploadProgressResetTimer = null;
  }
  importProgressPollToken += 1;
  clearToasts();
});

function normalizeFiles(inputFiles) {
  return [...inputFiles].map((file) => createNormalizedFile(file, file.webkitRelativePath || file.name));
}

function createNormalizedFile(file, relativePath) {
  return {
    file,
    name: file.name,
    relativePath: String(relativePath || file.name).replace(/^\/+/, ''),
  };
}

function buildDatasetSourcePath(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return '';
  }

  const relativePaths = files
    .map((item) => item.relativePath)
    .filter(Boolean);
  const topLevelParts = relativePaths
    .map((path) => path.split('/')[0])
    .filter(Boolean);

  return topLevelParts.length > 0 && topLevelParts.every((part) => part === topLevelParts[0])
    ? topLevelParts[0]
    : '';
}

function isLikelyAbsoluteDatasetPath(value) {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) {
    return false;
  }

  return /^[A-Za-z]:[\\/]/.test(trimmedValue) || trimmedValue.startsWith('/');
}

function buildSourceLabelFromPath(sourcePath) {
  const trimmedPath = String(sourcePath || '').trim().replace(/[\\/]+$/, '');
  if (!trimmedPath) {
    return '';
  }

  const parts = trimmedPath.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || trimmedPath;
}

function handleDatasetSourcePathInput(value) {
  datasetSourcePathInput.value = value;
  datasetSourcePathError.value = '';
}

function normalizeManifestPath(path) {
  return String(path || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase();
}

function buildFileManifest(files) {
  return (Array.isArray(files) ? files : [])
    .map((item) => ({
      path: normalizeManifestPath(item.relativePath),
      size: Number(item.file?.size || 0),
    }))
    .filter((entry) => entry.path);
}

function pathEndsWithPath(fullPath, suffixPath) {
  const fullSegments = normalizeManifestPath(fullPath).split('/').filter(Boolean);
  const suffixSegments = normalizeManifestPath(suffixPath).split('/').filter(Boolean);

  if (suffixSegments.length > fullSegments.length) {
    return false;
  }

  return suffixSegments.every((segment, index) => (
    fullSegments[fullSegments.length - suffixSegments.length + index] === segment
  ));
}

function manifestContainsEntry(containerManifest, targetEntry) {
  return containerManifest.some((entry) => (
    entry.size === targetEntry.size && pathEndsWithPath(entry.path, targetEntry.path)
  ));
}

function getManifestOverlapType(candidateManifest, existingManifest) {
  if (!candidateManifest.length || !existingManifest.length) {
    return '';
  }

  const candidateInExisting = candidateManifest.every((entry) => (
    manifestContainsEntry(existingManifest, entry)
  ));
  const existingInCandidate = existingManifest.every((entry) => (
    manifestContainsEntry(candidateManifest, entry)
  ));

  if (candidateInExisting && existingInCandidate) {
    return 'exact';
  }

  if (candidateInExisting) {
    return 'subset';
  }

  if (existingInCandidate) {
    return 'superset';
  }

  return '';
}

function buildDuplicateUploadConflict(candidateManifest, sourceLabel) {
  const overlappingDatasets = datasetRegistry.value
    .map((dataset) => ({
      dataset,
      overlapType: getManifestOverlapType(candidateManifest, dataset.fileManifest || []),
    }))
    .filter((entry) => entry.overlapType);

  if (!overlappingDatasets.length) {
    return null;
  }

  const exactMatches = overlappingDatasets.filter((entry) => entry.overlapType === 'exact');
  const subsetMatches = overlappingDatasets.filter((entry) => entry.overlapType === 'subset');
  const supersetMatches = overlappingDatasets.filter((entry) => entry.overlapType === 'superset');

  if (exactMatches.length > 0) {
    return {
      kind: 'exact',
      title: 'This dataset already exists in the workspace',
      message: `${sourceLabel || 'This folder'} matches a saved dataset. You can skip it, replace the saved version, or keep it as a separate dataset anyway.`,
      matches: exactMatches.map((entry) => entry.dataset),
      primaryAction: 'replace',
      primaryLabel: 'Replace Saved Dataset',
      separateLabel: 'Keep Separate Anyway',
      skipLabel: 'Skip Upload',
    };
  }

  if (subsetMatches.length > 0) {
    return {
      kind: 'subset',
      title: 'This folder is already contained in a saved dataset',
      message: `${sourceLabel || 'This folder'} appears to be a subset of an existing saved dataset. You can skip it, replace the broader saved dataset with this focused folder, or keep it as a separate dataset.`,
      matches: subsetMatches.map((entry) => entry.dataset),
      primaryAction: 'replace',
      primaryLabel: 'Use This Folder Instead',
      separateLabel: 'Keep Separate Anyway',
      skipLabel: 'Skip Upload',
    };
  }

  return {
    kind: 'superset',
    title: 'This folder overlaps saved dataset folders',
    message: `${sourceLabel || 'This folder'} appears to include one or more saved dataset folders. You can merge those saved datasets into this fuller upload, keep this upload separate, or skip it.`,
    matches: supersetMatches.map((entry) => entry.dataset),
    primaryAction: 'merge',
    primaryLabel: 'Merge Into Existing Workspace',
    separateLabel: 'Keep Separate Anyway',
    skipLabel: 'Skip Upload',
  };
}

function buildSelectedFolderLabel(files, source = 'selected') {
  if (!Array.isArray(files) || files.length === 0) {
    return 'No dataset folder staged';
  }

  const relativePaths = files
    .map((item) => item.relativePath)
    .filter(Boolean);
  const topLevelParts = relativePaths
    .map((path) => path.split('/')[0])
    .filter(Boolean);
  const hasFolderStructure = relativePaths.some((path) => path.includes('/'));
  const sharedRoot = topLevelParts.length > 0 && topLevelParts.every((part) => part === topLevelParts[0])
    ? topLevelParts[0]
    : '';
  const suffix = `${files.length} file${files.length === 1 ? '' : 's'} staged${source === 'dropped' ? ' from drop' : ''}`;

  if (sharedRoot && hasFolderStructure) {
    return `${sharedRoot} (${suffix})`;
  }

  return suffix;
}

function hasDraggedFiles(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }

  return Array.from(dataTransfer.types || []).includes('Files');
}

function readAllDirectoryEntries(reader) {
  return new Promise((resolve, reject) => {
    const entries = [];

    function readNextBatch() {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(entries);
          return;
        }

        entries.push(...batch);
        readNextBatch();
      }, reject);
    }

    readNextBatch();
  });
}

function readFileEntry(entry, parentPath = '') {
  return new Promise((resolve, reject) => {
    entry.file((file) => {
      const nextRelativePath = parentPath ? `${parentPath}/${file.name}` : file.name;
      resolve(createNormalizedFile(file, nextRelativePath));
    }, reject);
  });
}

async function collectFilesFromEntry(entry, parentPath = '') {
  if (!entry) {
    return [];
  }

  if (entry.isFile) {
    return [await readFileEntry(entry, parentPath)];
  }

  if (!entry.isDirectory) {
    return [];
  }

  const nextParentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  const nestedEntries = await readAllDirectoryEntries(entry.createReader());
  const collected = await Promise.all(
    nestedEntries.map((childEntry) => collectFilesFromEntry(childEntry, nextParentPath)),
  );

  return collected.flat();
}

async function extractDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []).filter((item) => item.kind === 'file');
  const supportsEntries = items.some((item) => typeof item.webkitGetAsEntry === 'function');

  if (supportsEntries) {
    const collected = await Promise.all(
      items.map(async (item) => {
        const entry = item.webkitGetAsEntry();
        return collectFilesFromEntry(entry);
      }),
    );

    return collected.flat();
  }

  return normalizeFiles(dataTransfer?.files || []);
}

function findNodeByPath(root, path) {
  if (!path) return root;

  const parts = path.split('/');
  let current = root;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    current = current.children.find((child) => child.name === part);
    if (!current) return null;
  }

  return current;
}

function collectRelativePaths(node) {
  const directFiles = node.files.map((file) => file.relativePath);
  node.children.forEach((child) => {
    directFiles.push(...collectRelativePaths(child));
  });
  return directFiles;
}

async function onFolderSelected(event) {
  const allFiles = normalizeFiles(event.target.files);
  if (allFiles.length === 0) {
    resetUploadProgressState();
    selectedFolderLabel.value = 'No dataset folder staged';
    datasetSourcePathInput.value = '';
    datasetSourcePathError.value = '';
    selectedDatasetSourcePath.value = '';
    if (folderInput.value) {
      folderInput.value.value = '';
    }
    analysisSessionId.value = '';
    analysisSummary.value = null;
    ignoredFileSummary.value = null;
    showIgnoredFiles.value = false;
    openedViewerSelections.value = [];
    treeRoot.value = null;
    currentPath.value = '';
    viewerUrl.value = '';
    currentFolderEntries.value = [];
    currentFolderInfo.value = { folderCount: 0, fileCount: 0 };
    selectedInspectorItem.value = null;
    inspectorMetadataSummary.value = null;
    inspectorMetadataError.value = '';
    inspectorMetadataLoading.value = false;
    expandedPaths.value = new Set();
    recentLocations.value = [];
    clearRecentActiveSession();
    window.history.replaceState({}, '', buildUrlForState({ sessionId: '' }));
    return;
  }

  await refreshDatasetRegistrySnapshot();
  const shouldContinue = await confirmLargeWorkspaceUpload();
  if (!shouldContinue) {
    resetUploadProgressState();
    if (folderInput.value) {
      folderInput.value.value = '';
    }
    return;
  }

  const detectedSourceLabel = buildDatasetSourcePath(allFiles);
  const conflict = buildDuplicateUploadConflict(
    buildFileManifest(allFiles),
    detectedSourceLabel,
  );
  let conflictResolution = null;

  if (conflict) {
    const resolution = await promptForDuplicateUploadResolution(conflict);
    if (resolution === 'skip') {
      resetUploadProgressState();
      showActionInfo('Upload', 'The overlapping dataset upload was skipped.');
      if (folderInput.value) {
        folderInput.value.value = '';
      }
      return;
    }

    if (resolution === 'replace' || resolution === 'merge') {
      conflictResolution = {
        mode: resolution,
        preservedLabel: conflict.matches[0]?.label || '',
        removeSessionIds: conflict.matches.map((dataset) => dataset.sessionId),
      };
    }
  }

  await analyzeSelectedFiles(allFiles, 'selected', conflictResolution);
}

async function readErrorMessage(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return payload?.error || fallbackMessage;
  } catch (_error) {
    return fallbackMessage;
  }
}

function postAnalyzeFormDataWithProgress(formData, { totalFiles = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', '/api/viewer/analyze');

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        updateUploadProgress({
          status: 'running',
          percent: uploadProgressPercent.value || 8,
          label: 'Uploading dataset files...',
          detail: totalFiles > 0
            ? `Sending ${totalFiles} file${totalFiles === 1 ? '' : 's'} to the local API.`
            : 'Sending selected files to the local API.',
        });
        return;
      }

      const percent = Math.max(1, Math.min(95, Math.round((event.loaded / event.total) * 95)));
      updateUploadProgress({
        status: 'running',
        percent,
        label: 'Uploading dataset files...',
        detail: totalFiles > 0
          ? `${percent}% uploaded across ${totalFiles} file${totalFiles === 1 ? '' : 's'}.`
          : `${percent}% uploaded.`,
      });
    };

    request.onload = () => {
      let payload = null;
      try {
        payload = request.responseText ? JSON.parse(request.responseText) : null;
      } catch (_error) {
        payload = null;
      }

      if (request.status < 200 || request.status >= 300) {
        reject(new Error(payload?.error || 'Analysis failed'));
        return;
      }

      updateUploadProgress({
        status: 'running',
        percent: 98,
        label: 'Creating dataset workspace...',
        detail: 'Upload complete. Finalizing local dataset analysis.',
      });
      resolve(payload);
    };

    request.onerror = () => {
      reject(new Error('Unable to upload dataset files to the local API.'));
    };

    request.onabort = () => {
      reject(new Error('Dataset upload was canceled.'));
    };

    request.send(formData);
  });
}

async function clearAnalyzedSession(sessionId) {
  if (!sessionId) {
    return;
  }

  try {
    await fetch('/api/viewer/clear-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });
  } catch (_error) {
    // Best-effort cleanup only.
  }
}

function resetAnalysisWorkspaceState() {
  resetImportProgressState();
  analysisSessionId.value = '';
  analysisSummary.value = null;
  ignoredFileSummary.value = null;
  showIgnoredFiles.value = false;
  openedViewerSelections.value = [];
  treeRoot.value = null;
  currentPath.value = '';
  currentFolderEntries.value = [];
  currentFolderInfo.value = { folderCount: 0, fileCount: 0 };
  expandedPaths.value = new Set();
  currentFolderSearchScope.value = defaultCurrentFolderControls.searchScope;
  currentFolderExtensionFilter.value = defaultCurrentFolderControls.extension;
  currentFolderSizeRange.value = defaultCurrentFolderControls.sizeRange;
  currentFolderSortBy.value = defaultCurrentFolderControls.sortBy;
  currentFolderSortDir.value = defaultCurrentFolderControls.sortDir;
  currentFolderPageSize.value = defaultCurrentFolderControls.pageSize;
  recentUploadSuccess.value = null;
  selectedFolderLabel.value = 'No dataset folder staged';
  datasetSourcePathInput.value = '';
  datasetSourcePathError.value = '';
  selectedDatasetSourcePath.value = '';
}

async function finalizeDatasetAnalysis(payload, options = {}) {
  await restoreAnalysisSession(payload, {
    navigationState: {
      sessionId: payload.sessionId,
    },
    replaceHistory: true,
    sourcePath: options.sourcePath || '',
  });

  const datasetRecord = await upsertDataset({
    sessionId: payload.sessionId,
    label: options.conflictResolution?.preservedLabel || '',
    sourcePath: options.sourcePath || '',
    sourceLabel: options.sourceLabel || '',
    summary: payload.summary,
    ignoredFiles: payload.ignoredFiles || null,
    currentPath: '',
    fileManifest: options.fileManifest || payload.fileManifest || [],
  });

  if (Array.isArray(options.conflictResolution?.removeSessionIds)) {
    await Promise.all(options.conflictResolution.removeSessionIds.map(async (sessionId) => {
      if (sessionId && sessionId !== payload.sessionId) {
        await removeDatasetBySessionId(sessionId);
      }
    }));
  }

  await refreshDatasetSelectorPage();
  await refreshWorkspaceDatasetManagementPage();

  addActivityLog(
    `${datasetRecord?.label || 'Dataset'} Workspace Ready`,
    `${datasetRecord?.label || 'The dataset'} is ready with ${payload.summary?.dicomFiles || 0} DICOM file(s) across ${payload.summary?.folderCount || 0} folder(s) in the current workspace.`,
  );
  recentUploadSuccess.value = {
    datasetId: datasetRecord?.id || '',
    datasetLabel: datasetRecord?.label || '',
    sessionId: payload.sessionId,
    dicomFiles: payload.summary?.dicomFiles || 0,
    folderCount: payload.summary?.folderCount || 0,
  };
  showActionSuccess(
    datasetRecord?.label || 'Dataset Created',
    `${datasetRecord?.label || 'The dataset'} workspace is ready with ${payload.summary?.dicomFiles || 0} DICOM file${payload.summary?.dicomFiles === 1 ? '' : 's'} across ${payload.summary?.folderCount || 0} folder${payload.summary?.folderCount === 1 ? '' : 's'}.`,
  );
  navigateToPortalPage('datasets');
}

async function analyzeSelectedFiles(allFiles, source = 'selected', conflictResolution = null) {
  const detectedSourceLabel = buildDatasetSourcePath(allFiles);
  const typedSourcePath = datasetSourcePathInput.value.trim();
  selectedDatasetSourcePath.value = isLikelyAbsoluteDatasetPath(typedSourcePath)
    ? typedSourcePath
    : detectedSourceLabel;
  selectedFolderLabel.value = buildSelectedFolderLabel(allFiles, source);
  analyzing.value = true;
  viewerUrl.value = '';
  updateUploadProgress({
    status: 'running',
    percent: 1,
    label: source === 'dropped' ? 'Preparing dropped dataset...' : 'Preparing selected dataset...',
    detail: `Preparing ${allFiles.length} file${allFiles.length === 1 ? '' : 's'} for local upload.`,
  });
  const fileManifest = buildFileManifest(allFiles);
  addActivityLog(
    'Creating Dataset...',
    `Creating dataset locally from ${selectedFolderLabel.value}.`,
  );

  try {
    const formData = new FormData();
    allFiles.forEach((item) => {
      formData.append('files', item.file, item.name);
      formData.append('relativePaths', item.relativePath);
    });

    const payload = await postAnalyzeFormDataWithProgress(formData, {
      totalFiles: allFiles.length,
    });
    await finalizeDatasetAnalysis(payload, {
      sourcePath: selectedDatasetSourcePath.value,
      sourceLabel: detectedSourceLabel,
      fileManifest,
      conflictResolution,
    });
    updateUploadProgress({
      status: 'completed',
      percent: 100,
      label: 'Dataset upload complete',
      detail: `${payload.summary?.dicomFiles || 0} DICOM file${payload.summary?.dicomFiles === 1 ? '' : 's'} ready in the dataset workspace.`,
    });
    scheduleUploadProgressReset(3000);
  } catch (error) {
    console.error(error);
    resetAnalysisWorkspaceState();
    updateUploadProgress({
      status: 'failed',
      percent: uploadProgressPercent.value,
      label: 'Dataset upload failed',
      detail: error.message || 'Analysis failed. Please try the folder again.',
    });
    scheduleUploadProgressReset(7000);
    showActionError('Analysis', error.message || 'Analysis failed. Please try the folder again.');
  } finally {
    analyzing.value = false;
  }
}

async function analyzeDatasetFromPath() {
  const sourcePath = datasetSourcePathInput.value.trim();
  if (!sourcePath) {
    datasetSourcePathError.value = 'Enter an absolute dataset path before starting upload.';
    return;
  }

  if (!isLikelyAbsoluteDatasetPath(sourcePath)) {
    datasetSourcePathError.value = 'Enter an absolute Windows, macOS, or Linux dataset path.';
    return;
  }

  datasetSourcePathError.value = '';
  selectedDatasetSourcePath.value = sourcePath;
  selectedFolderLabel.value = `${buildSourceLabelFromPath(sourcePath) || sourcePath} (path upload requested)`;
  analyzing.value = true;
  viewerUrl.value = '';
  updateUploadProgress({
    status: 'running',
    percent: 10,
    label: 'Analyzing dataset path...',
    detail: 'The local API is scanning the configured source path. No browser file upload is needed for this flow.',
  });
  addActivityLog(
    'Creating Dataset...',
    `Creating dataset locally from ${sourcePath}.`,
  );

  try {
    await refreshDatasetRegistrySnapshot();
    const shouldContinue = await confirmLargeWorkspaceUpload();
    if (!shouldContinue) {
      resetUploadProgressState();
      return;
    }

    updateUploadProgress({
      status: 'running',
      percent: 30,
      label: 'Reading dataset path...',
      detail: 'Scanning files and identifying DICOM objects from the configured local source root.',
    });
    const response = await fetch('/api/viewer/analyze-path', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sourcePath }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to analyze the dataset path.'));
    }

    const payload = await response.json();
    updateUploadProgress({
      status: 'running',
      percent: 80,
      label: 'Creating dataset workspace...',
      detail: 'Path analysis complete. Finalizing the local dataset workspace.',
    });
    const conflict = buildDuplicateUploadConflict(payload.fileManifest || [], sourcePath);
    let conflictResolution = null;

    if (conflict) {
      const resolution = await promptForDuplicateUploadResolution(conflict);
      if (resolution === 'skip') {
        await clearAnalyzedSession(payload.sessionId);
        resetUploadProgressState();
        showActionInfo('Upload', 'The overlapping dataset upload was skipped.');
        return;
      }

      if (resolution === 'replace' || resolution === 'merge') {
        conflictResolution = {
          mode: resolution,
          preservedLabel: conflict.matches[0]?.label || '',
          removeSessionIds: conflict.matches.map((dataset) => dataset.sessionId),
        };
      }
    }

    await finalizeDatasetAnalysis(payload, {
      sourcePath,
      sourceLabel: buildSourceLabelFromPath(sourcePath),
      fileManifest: payload.fileManifest || [],
      conflictResolution,
    });
    updateUploadProgress({
      status: 'completed',
      percent: 100,
      label: 'Dataset path analysis complete',
      detail: `${payload.summary?.dicomFiles || 0} DICOM file${payload.summary?.dicomFiles === 1 ? '' : 's'} ready in the dataset workspace.`,
    });
    scheduleUploadProgressReset(3000);
  } catch (error) {
    console.error(error);
    datasetSourcePathError.value = error.message || 'Unable to analyze the dataset path.';
    updateUploadProgress({
      status: 'failed',
      percent: uploadProgressPercent.value,
      label: 'Dataset path analysis failed',
      detail: datasetSourcePathError.value,
    });
    scheduleUploadProgressReset(7000);
    showActionError('Upload Dataset From Path', datasetSourcePathError.value);
  } finally {
    analyzing.value = false;
  }
}

function resetUploadDragState() {
  uploadDragDepth = 0;
  isUploadDragActive.value = false;
}

function handleUploadDragEnter(event) {
  if (!hasDraggedFiles(event.dataTransfer)) {
    return;
  }

  uploadDragDepth += 1;
  isUploadDragActive.value = true;
}

function handleUploadDragOver(event) {
  if (!hasDraggedFiles(event.dataTransfer)) {
    return;
  }

  event.dataTransfer.dropEffect = 'copy';
  isUploadDragActive.value = true;
}

function handleUploadDragLeave(event) {
  if (!hasDraggedFiles(event.dataTransfer)) {
    return;
  }

  uploadDragDepth = Math.max(0, uploadDragDepth - 1);
  if (uploadDragDepth === 0) {
    isUploadDragActive.value = false;
  }
}

async function handleUploadDrop(event) {
  resetUploadDragState();

  if (analyzing.value) {
    return;
  }

  try {
    updateUploadProgress({
      status: 'running',
      percent: 5,
      label: 'Reading dropped folder...',
      detail: 'Collecting files from the dropped folder before upload starts.',
    });
    await refreshDatasetRegistrySnapshot();
    const shouldContinue = await confirmLargeWorkspaceUpload();
    if (!shouldContinue) {
      resetUploadProgressState();
      return;
    }

    const droppedFiles = await extractDroppedFiles(event.dataTransfer);
    if (droppedFiles.length === 0) {
      resetUploadProgressState();
      showActionError('Analysis', 'No readable files were found in the dropped folder.');
      return;
    }
    updateUploadProgress({
      status: 'running',
      percent: 8,
      label: 'Dropped folder ready...',
      detail: `${droppedFiles.length} file${droppedFiles.length === 1 ? '' : 's'} collected. Preparing local upload.`,
    });

    const detectedSourceLabel = buildDatasetSourcePath(droppedFiles);
    const conflict = buildDuplicateUploadConflict(
      buildFileManifest(droppedFiles),
      detectedSourceLabel,
    );
    let conflictResolution = null;

    if (conflict) {
      const resolution = await promptForDuplicateUploadResolution(conflict);
      if (resolution === 'skip') {
        resetUploadProgressState();
        showActionInfo('Upload', 'The overlapping dataset upload was skipped.');
        return;
      }

      if (resolution === 'replace' || resolution === 'merge') {
        conflictResolution = {
          mode: resolution,
          preservedLabel: conflict.matches[0]?.label || '',
          removeSessionIds: conflict.matches.map((dataset) => dataset.sessionId),
        };
      }
    }

    await analyzeSelectedFiles(droppedFiles, 'dropped', conflictResolution);
  } catch (error) {
    console.error(error);
    updateUploadProgress({
      status: 'failed',
      percent: uploadProgressPercent.value,
      label: 'Dropped folder upload failed',
      detail: 'Unable to read the dropped folder. Try the folder picker instead.',
    });
    scheduleUploadProgressReset(7000);
    showActionError('Analysis', 'Unable to read the dropped folder. Try the folder picker instead.');
  }
}

async function restoreSessionFromUrl() {
  const navigationState = readNavigationStateFromUrl();
  if (!navigationState.sessionId) {
    return;
  }

  try {
    const response = await fetch(
      `/api/viewer/session?${new URLSearchParams({ sessionId: navigationState.sessionId }).toString()}`,
    );

    if (!response.ok) {
      throw new Error('Unable to restore session from URL');
    }

    const payload = await response.json();
    await restoreAnalysisSession(payload, {
      navigationState,
      replaceHistory: true,
    });
  } catch (error) {
    console.error(error);
    window.history.replaceState({}, '', buildUrlForState({ sessionId: '' }));
  }
}

async function resumeRecentActiveSession() {
  if (!recentActiveSession.value?.sessionId) {
    clearRecentActiveSession();
    return;
  }

  resumeSessionLoading.value = true;

  try {
    const response = await fetch(
      `/api/viewer/session?${new URLSearchParams({ sessionId: recentActiveSession.value.sessionId }).toString()}`,
    );

    if (!response.ok) {
      throw new Error('Unable to resume recent session');
    }

    const payload = await response.json();
    await restoreAnalysisSession(payload, {
      navigationState: recentActiveSession.value,
      replaceHistory: true,
    });
    recentUploadSuccess.value = null;
    addActivityLog(
      'Session Resumed',
      `Resumed the active local session at ${recentActiveSession.value.currentPath || 'Root'}.`,
    );
    showActionSuccess(
      'Session Resume',
      `Resumed the active local session at ${recentActiveSession.value.currentPath || 'Root'}. Datasets is ready to browse.`,
    );
    navigateToPortalPage('datasets');
  } catch (error) {
    console.error(error);
    clearRecentActiveSession();
    showActionError('Session Resume', 'The recent active session is no longer available. Please analyze the folder again.');
  } finally {
    resumeSessionLoading.value = false;
  }
}

async function openWorkspaceDataset(datasetId, options = {}) {
  let dataset = findDatasetById(datasetId);
  if (!dataset) {
    await refreshDatasetRegistrySnapshot();
    dataset = findDatasetById(datasetId);
  }
  if (!dataset?.sessionId) {
    showActionError('Dataset Open', 'The selected dataset is no longer available.');
    return null;
  }

  datasetSwitchLoadingId.value = datasetId;

  try {
    const response = await fetch(
      `/api/viewer/session?${new URLSearchParams({ sessionId: dataset.sessionId }).toString()}`,
    );

    if (!response.ok) {
      throw new Error('Unable to open workspace dataset');
    }

    const payload = await response.json();
    await restoreAnalysisSession(payload, {
      navigationState: {
        sessionId: dataset.sessionId,
        currentPath: dataset.currentPath || '',
      },
      replaceHistory: true,
      sourcePath: dataset.sourcePath || '',
    });
    setActiveDatasetById(dataset.id);
    recentUploadSuccess.value = null;
    if (options.recordActivity !== false) {
      addActivityLog(
        `${dataset.label} Opened`,
        `${dataset.label} was reopened${dataset.currentPath ? ` at ${dataset.currentPath}` : ' at Root'}.`,
      );
    }
    if (options.showFeedback !== false) {
      showActionSuccess(
        dataset.label,
        `${dataset.label} is now active in the datasets workspace.`,
      );
    }
    navigateToPortalPage(options.targetPage || 'datasets');
    return dataset;
  } catch (error) {
    console.error(error);
    try {
      await reconcileDatasetRegistrySessions(dataset.id);
      await refreshDatasetRegistrySnapshot();
      await refreshDatasetSelectorPage();
      await refreshWorkspaceDatasetManagementPage();
    } catch (reconcileError) {
      console.error(reconcileError);
    }
    showActionError(dataset.label, `${dataset.label} could not be reopened because its saved session is no longer available.`);
    return null;
  } finally {
    datasetSwitchLoadingId.value = '';
  }
}

async function ensureWorkspaceDatasetActive(datasetId, options = {}) {
  let dataset = findDatasetById(datasetId);
  if (!dataset) {
    await refreshDatasetRegistrySnapshot();
    dataset = findDatasetById(datasetId);
  }
  if (!dataset) {
    return null;
  }

  if (dataset.id === activeDatasetId.value && dataset.sessionId === analysisSessionId.value) {
    return dataset;
  }

  return openWorkspaceDataset(datasetId, {
    showFeedback: options.showFeedback ?? false,
    recordActivity: options.recordActivity ?? false,
    targetPage: options.targetPage || 'datasets',
  });
}

async function openWorkspaceDatasetAnalytics(datasetId) {
  const dataset = await ensureWorkspaceDatasetActive(datasetId, {
    targetPage: 'analytics',
  });
  if (!dataset) {
    return;
  }

  addActivityLog(
    `${dataset.label} Analytics Opened`,
    `${dataset.label} was opened directly in Analytics & Activity.`,
  );
  showActionSuccess(dataset.label, `${dataset.label} is now open in Analytics & Activity.`);
  navigateToPortalPage('analytics');
}

async function exportWorkspaceDatasetSummary(datasetId, format = 'json') {
  const dataset = await ensureWorkspaceDatasetActive(datasetId);
  if (!dataset) {
    return;
  }

  await exportSessionSummary(format);
}

async function clearWorkspaceDatasetImportedStudies(datasetId) {
  const dataset = await ensureWorkspaceDatasetActive(datasetId, {
    targetPage: 'analytics',
  });
  if (!dataset) {
    return;
  }

  await clearImportedStudies();
}

async function removeDatasetEverywhere(dataset) {
  if (!dataset) {
    return false;
  }

  if (dataset.sessionId) {
    try {
      const response = await fetch('/api/viewer/clear-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: dataset.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to clear dataset session');
      }
    } catch (error) {
      console.error(error);
      showActionError('Remove Dataset Everywhere', `Unable to clear the saved session for ${dataset.label}.`);
      return false;
    }

    clearRecentLocationsForSession(dataset.sessionId);
    clearOpenedSelectionsForSession(dataset.sessionId);
    clearActivityLogForSession(dataset.sessionId);
    clearUsageIndicatorsForSession(dataset.sessionId);
  }

  try {
    await removeDatasetById(dataset.id);
  } catch (error) {
    console.error(error);
    showActionError('Remove Dataset Everywhere', `Unable to remove ${dataset.label} from the saved dataset registry.`);
    return false;
  }

  if (dataset.id === activeDatasetId.value || dataset.sessionId === analysisSessionId.value) {
    resetImportProgressState();
    analysisSessionId.value = '';
    analysisSummary.value = null;
    ignoredFileSummary.value = null;
    showIgnoredFiles.value = false;
    treeRoot.value = null;
    currentPath.value = '';
    usageIndicators.value = null;
    viewerUrl.value = '';
    currentFolderEntries.value = [];
    currentFolderInfo.value = { folderCount: 0, fileCount: 0 };
    selectedInspectorItem.value = null;
    inspectorMetadataSummary.value = null;
    inspectorMetadataError.value = '';
    inspectorMetadataLoading.value = false;
    recentLocations.value = [];
    currentFolderControls.value = {
      page: 1,
      pageSize: 25,
      totalResults: 0,
      totalPages: 1,
    };
    expandedPaths.value = new Set();
    clearRecentActiveSession();
    clearActiveDataset();
    recentUploadSuccess.value = null;
    selectedFolderLabel.value = 'No dataset folder staged';
    datasetSourcePathInput.value = '';
    datasetSourcePathError.value = '';
    selectedDatasetSourcePath.value = '';
    navigateToPortalPage('dashboard');
  }

  await refreshDatasetSelectorPage();
  await refreshWorkspaceDatasetManagementPage();
  showActionSuccess('Remove Dataset Everywhere', `${dataset.label} was removed from the local workspace.`);
  return true;
}

async function removeWorkspaceDatasetEverywhere(datasetId) {
  let dataset = findDatasetById(datasetId);
  if (!dataset) {
    await refreshDatasetRegistrySnapshot();
    dataset = findDatasetById(datasetId);
  }

  if (!dataset) {
    showActionError('Remove Dataset Everywhere', 'The selected dataset is no longer available.');
    return;
  }

  await removeDatasetEverywhere(dataset);
}

async function removeWorkspaceDataset(datasetId) {
  let dataset = findDatasetById(datasetId);
  if (!dataset) {
    await refreshDatasetRegistrySnapshot();
    dataset = findDatasetById(datasetId);
  }
  if (!dataset) {
    showActionError('Remove Saved Dataset', 'The selected dataset is no longer available.');
    return;
  }

  const choice = await promptForSaveChoice({
    eyebrow: 'Saved Dataset',
    title: `Choose how to remove ${dataset.label}`,
    message: 'Decide whether to remove only the saved dataset entry or remove the dataset everywhere in the local workspace. The original source folder will not be deleted.',
    options: [
      {
        value: 'registry-only',
        label: 'Remove Saved Dataset',
        description: 'Remove only the saved dataset entry and keep any live local session or Orthanc imports unchanged.',
        recommended: true,
      },
      {
        value: 'remove-everywhere',
        label: 'Remove Dataset Everywhere',
        description: 'Remove the saved dataset entry, clear the live session if active, clear browser traces for that dataset, and remove imported Orthanc studies.',
      },
    ],
  });

  if (!choice) {
    showActionInfo('Remove Saved Dataset', `${dataset.label} stays in the saved dataset list.`);
    return;
  }

  if (choice === 'remove-everywhere') {
    await removeDatasetEverywhere(dataset);
    return;
  }

  const isActiveDataset = dataset.id === activeDatasetId.value;
  try {
    await removeDatasetById(dataset.id);
  } catch (error) {
    console.error(error);
    showActionError('Remove Saved Dataset', `Unable to remove ${dataset.label} from the saved dataset list.`);
    return;
  }

  if (isActiveDataset) {
    clearActiveDataset();
  }

  await refreshDatasetSelectorPage();
  await refreshWorkspaceDatasetManagementPage();

  showActionSuccess('Remove Saved Dataset', `${dataset.label} was removed from the saved dataset list.`);
}

async function removeActiveDatasetEverywhere() {
  if (!analysisSessionId.value) {
    return;
  }

  let dataset = findDatasetBySessionId(analysisSessionId.value);
  if (!dataset && activeDatasetId.value) {
    dataset = findDatasetById(activeDatasetId.value);
  }
  if (!dataset) {
    await refreshDatasetRegistrySnapshot();
    dataset = findDatasetBySessionId(analysisSessionId.value)
      || findDatasetById(activeDatasetId.value);
  }

  if (!dataset) {
    showActionError('Remove Dataset Everywhere', 'The active dataset is no longer available in the saved registry.');
    return;
  }

  await removeDatasetEverywhere(dataset);
}

async function restoreAnalysisSession(payload, options = {}) {
  const existingDataset = findDatasetBySessionId(payload.sessionId);
  const navigationState = buildQueryStateFromNavigation({
    sessionId: payload.sessionId,
    ...options.navigationState,
  });

  isApplyingHistoryState.value = true;

  try {
    analysisSessionId.value = payload.sessionId;
    analysisSummary.value = payload.summary;
    ignoredFileSummary.value = payload.ignoredFiles || null;
    showIgnoredFiles.value = false;
    loadOpenedSelectionsForSession(payload.sessionId);
    loadActivityLogForSession(payload.sessionId);
    treeRoot.value = payload.tree;
    viewerUrl.value = '';
    loadRecentLocationsForSession(payload.sessionId);
    loadUsageIndicatorsForSession(payload.sessionId);
    currentPath.value = navigationState.currentPath;
    folderSearchInput.value = navigationState.search;
    debouncedFolderSearch.value = navigationState.search;
    currentFolderSearchScope.value = navigationState.searchScope;
    currentFolderExtensionFilter.value = navigationState.extension;
    currentFolderSizeRange.value = navigationState.sizeRange;
    currentFolderSortBy.value = navigationState.sortBy;
    currentFolderSortDir.value = navigationState.sortDir;
    currentFolderPageSize.value = navigationState.pageSize;
    currentFolderControls.value = {
      ...currentFolderControls.value,
      page: navigationState.page,
      pageSize: Number(navigationState.pageSize),
      totalResults: 0,
      totalPages: 1,
    };

    const nextExpandedPaths = new Set(payload.tree?.children?.map((node) => node.path) || []);
    const selectedParts = navigationState.currentPath
      ? navigationState.currentPath.split('/').filter(Boolean)
      : [];
    let runningPath = '';
    selectedParts.forEach((part) => {
      runningPath = runningPath ? `${runningPath}/${part}` : part;
      nextExpandedPaths.add(runningPath);
    });
    expandedPaths.value = nextExpandedPaths;

    await fetchCurrentFolderResults();
    await refreshUsageIndicators();
  } finally {
    isApplyingHistoryState.value = false;
  }

  persistRecentActiveSession(navigationState);
  await upsertDataset({
    sessionId: payload.sessionId,
    sourcePath: options.sourcePath || existingDataset?.sourcePath || '',
    sourceLabel: options.sourcePath || existingDataset?.sourceLabel || '',
    summary: payload.summary,
    ignoredFiles: payload.ignoredFiles || null,
    currentPath: navigationState.currentPath,
  });
  await refreshDatasetSelectorPage();
  await refreshWorkspaceDatasetManagementPage();
  syncHistoryState({ replace: options.replaceHistory === true });
}

async function openCurrentSelection() {
  const relativePaths = collectRelativePaths(currentNode.value);
  await openSelection(relativePaths, currentNode.value?.label || 'Current selection');
}

async function openInspectorSelection() {
  if (!selectedInspectorItem.value) {
    return;
  }

  if (selectedInspectorItem.value.type === 'folder') {
    if (!selectedInspectorNode.value) {
      return;
    }

    await openSelection(
      collectRelativePaths(selectedInspectorNode.value),
      selectedInspectorItem.value.displayName,
    );
    return;
  }

  await openSelection([selectedInspectorItem.value.relativePath], selectedInspectorItem.value.displayName);
}

function parseFilenameFromDisposition(disposition) {
  if (!disposition) {
    return '';
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const fallbackMatch = disposition.match(/filename="([^"]+)"/i);
  return fallbackMatch?.[1] || '';
}

function triggerBrowserDownload(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename || 'dicom-selection';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 0);
}

async function downloadSelection(relativePaths, options = {}) {
  if (!analysisSessionId.value || !Array.isArray(relativePaths) || relativePaths.length === 0) {
    showActionError('Download', 'No analyzed DICOM files are available to download.');
    return;
  }

  exporting.value = true;

  try {
    const response = await fetch('/api/viewer/download-selection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: analysisSessionId.value,
        relativePaths,
        downloadName: options.downloadName,
        basePath: options.basePath,
        archiveRoot: options.archiveRoot,
      }),
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const downloadBlob = await response.blob();
    const filename = parseFilenameFromDisposition(response.headers.get('Content-Disposition'))
      || options.fallbackFilename
      || 'dicom-selection.tar';

    await saveBlobLocally(downloadBlob, filename, response.headers.get('Content-Type') || '');
    showActionSuccess(
      'Download',
      `Prepared a local download for ${relativePaths.length} file${relativePaths.length === 1 ? '' : 's'}.`,
    );
    addActivityLog(
      'Download Prepared',
      `Prepared a local download for ${relativePaths.length} DICOM file${relativePaths.length === 1 ? '' : 's'}.`,
    );
  } catch (error) {
    if (error?.name === 'AbortError') {
      showActionInfo('Download', 'Local download was canceled.');
    } else {
      console.error(error);
      showActionError('Download', 'Unable to prepare the local download.');
    }
  } finally {
    exporting.value = false;
  }
}

async function downloadInspectorSelection() {
  if (!selectedInspectorItem.value) {
    return;
  }

  if (selectedInspectorItem.value.type === 'folder') {
    if (!selectedInspectorNode.value) {
      showActionError('Download', 'No folder selection is available to download.');
      return;
    }

    const relativePaths = collectRelativePaths(selectedInspectorNode.value);
    await downloadSelection(relativePaths, {
      downloadName: selectedInspectorItem.value.displayName,
      basePath: selectedInspectorItem.value.path,
      archiveRoot: selectedInspectorItem.value.displayName,
      fallbackFilename: `${selectedInspectorItem.value.displayName}.tar`,
    });
    return;
  }

  await downloadSelection([selectedInspectorItem.value.relativePath], {
    downloadName: selectedInspectorItem.value.displayName,
    fallbackFilename: selectedInspectorItem.value.displayName,
  });
}

async function openSingleFile(file) {
  await openSelection([file.relativePath], file.fileName || file.name || 'Selected file');
}

async function openGroupedPaths(relativePaths) {
  await openSelection(relativePaths, 'Grouped selection');
}

function renderPendingViewerWindow(pendingWindow, { totalFiles = 0, jobId = '' } = {}) {
  if (!pendingWindow || pendingWindow.closed) {
    return;
  }

  if (typeof pendingWindow.setImportProgressJob === 'function') {
    pendingWindow.setImportProgressJob(String(jobId || ''), Number(totalFiles || 0));
    return;
  }

  const safeJobId = JSON.stringify(String(jobId || ''));
  const safeTotalFiles = JSON.stringify(Number(totalFiles || 0));

  pendingWindow.document.open();
  pendingWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <title>Loading viewer...</title>
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f6f7fb;
            color: #1b2733;
          }

          main {
            width: min(30rem, calc(100vw - 2rem));
            padding: 1.5rem;
            border: 1px solid #d6deea;
            border-radius: 0.5rem;
            background: #ffffff;
            box-shadow: 0 18px 48px rgba(21, 38, 63, 0.12);
          }

          span {
            display: block;
            color: #607086;
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          strong {
            display: block;
            margin-top: 0.45rem;
            font-size: 1.1rem;
          }

          p {
            margin: 0.7rem 0 1rem;
            color: #44546a;
            line-height: 1.45;
          }

          .bar {
            overflow: hidden;
            height: 0.65rem;
            border-radius: 999px;
            background: #e7edf5;
          }

          .fill {
            display: block;
            width: 0%;
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, #fde68a 0%, #facc15 35%, #f97316 70%, #22c55e 100%);
            transition: width 180ms ease;
          }

          .meta {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            margin-top: 0.75rem;
            color: #607086;
            font-size: 0.88rem;
          }
        </style>
      </head>
      <body>
        <main>
          <span>Orthanc Import Progress</span>
          <strong id="status">Preparing Import</strong>
          <p id="label">Preparing to import DICOM files into Orthanc...</p>
          <div class="bar" role="progressbar" aria-label="Orthanc import progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <i id="fill" class="fill"></i>
          </div>
          <div class="meta">
            <small id="count">0 / ${Number(totalFiles || 0)} completed</small>
            <small id="percent">0%</small>
          </div>
        </main>
        <script>
          let activeJobId = ${safeJobId};
          let activeTotalFiles = ${safeTotalFiles};
          let isPolling = false;
          const statusNode = document.getElementById('status');
          const labelNode = document.getElementById('label');
          const countNode = document.getElementById('count');
          const percentNode = document.getElementById('percent');
          const fillNode = document.getElementById('fill');
          const barNode = document.querySelector('.bar');

          function plural(count) {
            return count === 1 ? 'file' : 'files';
          }

          function setProgress(job) {
            const status = job.status || 'queued';
            const total = Number(job.totalFiles || activeTotalFiles || 0);
            const failed = Number(job.failedFiles || job.skippedFileCount || 0);
            const completed = status === 'completed' && Number.isFinite(Number(job.importedFileCount))
              ? Number(job.importedFileCount || 0)
              : Number(job.completedFiles || 0);
            const percent = status === 'completed'
              ? 100
              : Math.max(0, Math.min(100, Number(job.percentComplete || 0)));

            statusNode.textContent = status === 'completed'
              ? 'Import Complete'
              : status === 'failed'
                ? 'Import Failed'
                : status === 'queued'
                  ? 'Preparing Import'
                  : 'Importing into Orthanc';
            labelNode.textContent = status === 'completed'
              ? (failed > 0
                ? 'Imported ' + completed + ' of ' + total + ' ' + plural(total) + ' with ' + failed + ' skipped.'
                : 'Imported ' + completed + ' of ' + total + ' ' + plural(total) + '.')
              : status === 'failed'
                ? (job.errorMessage || 'Orthanc import failed.')
                : total > 0
                  ? 'Importing into Orthanc... ' + completed + ' / ' + total + ' ' + plural(total)
                  : 'Importing into Orthanc...';
            countNode.textContent = completed + ' / ' + total + (status === 'completed' ? ' imported' : ' completed');
            percentNode.textContent = percent + '%';
            fillNode.style.width = percent + '%';
            barNode.setAttribute('aria-valuenow', String(percent));
          }

          async function poll() {
            if (!activeJobId) {
              window.setTimeout(poll, 500);
              return;
            }

            try {
              const response = await fetch('/api/viewer/import-progress?' + new URLSearchParams({ jobId: activeJobId }).toString());
              if (!response.ok) {
                throw new Error('Unable to read progress');
              }

              const job = await response.json();
              setProgress(job);
              if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') {
                return;
              }
              window.setTimeout(poll, 400);
            } catch (_error) {
              window.setTimeout(poll, 800);
            }
          }

          window.setImportProgressJob = function setImportProgressJob(nextJobId, nextTotalFiles) {
            activeJobId = String(nextJobId || activeJobId || '');
            activeTotalFiles = Number(nextTotalFiles || activeTotalFiles || 0);
            countNode.textContent = '0 / ' + activeTotalFiles + ' completed';

            if (!isPolling) {
              isPolling = true;
              poll();
            }
          };

          window.setImportProgressJob(activeJobId, activeTotalFiles);
        <\/script>
      </body>
    </html>
  `);
  pendingWindow.document.close();
}

async function openSelection(relativePaths, contextLabel = 'this selection') {
  if (relativePaths.length === 0 || !analysisSessionId.value) return;

  const confirmed = confirmLargeSelection(relativePaths, contextLabel);
  if (!confirmed) {
    showActionInfo('Viewer Import', 'Large viewer import was canceled. No files were imported into OHIF.');
    addActivityLog(
      'Large Import Canceled',
      `Canceled opening ${relativePaths.length} file(s) from ${contextLabel}.`,
    );
    return;
  }

  const pendingWindow = viewerMode.value === 'new-tab'
    ? window.open('', '_blank')
    : null;

  if (pendingWindow) {
    renderPendingViewerWindow(pendingWindow, { totalFiles: relativePaths.length });
  }

  if (viewerMode.value === 'new-tab' && !pendingWindow) {
    showActionError('Viewer Launch', 'The browser blocked the new viewer tab. Please allow popups for localhost and try again.');
    addActivityLog(
      'Viewer Tab Blocked',
      `The browser blocked opening a new tab for ${contextLabel}.`,
    );
    return;
  }

  initializeImportProgressState(relativePaths);
  importing.value = true;

  try {
    const response = await fetch('/api/viewer/import-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: analysisSessionId.value,
        relativePaths,
      }),
    });

    if (!response.ok) {
      throw new Error('Import failed');
    }

    const importStartPayload = await response.json();
    let payload = importStartPayload;

    if (importStartPayload.jobId) {
      if (pendingWindow) {
        renderPendingViewerWindow(pendingWindow, {
          totalFiles: importStartPayload.totalFiles || relativePaths.length,
          jobId: importStartPayload.jobId,
        });
      }
      const completedJob = await startImportProgressPolling(importStartPayload.jobId);
      if (!completedJob) {
        throw new Error('Import progress did not complete');
      }
      payload = completedJob;
    }

    syncImportProgressFromJob(payload);
    if (!Array.isArray(payload.importedPaths) || payload.importedPaths.length === 0) {
      throw new Error('No DICOM files could be imported into Orthanc.');
    }

    const nextViewerUrl = buildViewerUrl(payload.importedPaths);
    const uniqueStudyCount = new Set(
      (payload.importedPaths || []).map((item) => item.studyUid).filter(Boolean),
    ).size;
    const uniqueSeriesCount = new Set(
      (payload.importedPaths || []).map((item) => item.seriesUid).filter(Boolean),
    ).size;
    const importedFileCount = Number(payload.importedFileCount || payload.importedPaths?.length || 0);
    const skippedFileCount = Number(payload.skippedFileCount || 0);

    viewerUrl.value = nextViewerUrl;
    recordOpenedSelection({
      label: relativePaths.length === 1
        ? relativePaths[0].split('/').pop()
        : currentNode.value?.label || `${relativePaths.length} files`,
      fileCount: relativePaths.length,
      studyCount: uniqueStudyCount,
      seriesCount: uniqueSeriesCount,
      firstPath: relativePaths[0] || '',
      viewerUrl: nextViewerUrl,
    });
    addActivityLog(
      skippedFileCount > 0 ? 'Viewer Opened With Skips' : 'Viewer Opened',
      skippedFileCount > 0
        ? `Imported ${importedFileCount} of ${relativePaths.length} file(s) into OHIF across ${uniqueStudyCount || 0} stud${uniqueStudyCount === 1 ? 'y' : 'ies'}; ${skippedFileCount} file(s) were skipped.`
        : `Imported ${importedFileCount || relativePaths.length} file(s) into OHIF across ${uniqueStudyCount || 0} stud${uniqueStudyCount === 1 ? 'y' : 'ies'}.`,
    );
    if (uniqueStudyCount > 0 && activeDataset.value) {
      await updateActiveDataset({
        status: {
          orthancImported: true,
        },
      });
    }
    if (skippedFileCount > 0) {
      showToast(
        `Opened ${importedFileCount} of ${relativePaths.length} file${relativePaths.length === 1 ? '' : 's'} in the local viewer; ${skippedFileCount} could not be imported. ${getViewerLaunchMessage()}`,
        'info',
        'Viewer Import Partial',
      );
    } else {
      showActionSuccess(
        'Viewer Import',
        `Opened ${importedFileCount || relativePaths.length} file${relativePaths.length === 1 ? '' : 's'} in the local viewer. ${getViewerLaunchMessage()}`,
      );
    }
    scheduleImportProgressReset(4000);
    await refreshUsageIndicators();

    if (viewerMode.value === 'new-tab') {
      if (pendingWindow) {
        pendingWindow.location.href = nextViewerUrl;
      } else {
        window.open(nextViewerUrl, '_blank');
      }
    }
  } catch (error) {
    console.error(error);
    if (importProgressStatus.value !== 'failed' && importProgressStatus.value !== 'canceled') {
      importProgressStatus.value = 'failed';
      importProgressLabel.value = error instanceof Error && error.message
        ? `Orthanc import failed: ${error.message}`
        : 'Orthanc import failed.';
    }
    scheduleImportProgressReset(8000);
    if (pendingWindow && !pendingWindow.closed) {
      pendingWindow.close();
    }
    showActionError(
      'Viewer Import',
      error instanceof Error && error.message
        ? error.message
        : 'Import failed. Please verify the selected files are valid DICOM files.',
    );
  } finally {
    importing.value = false;
  }
}

async function clearImportedStudies() {
  if (!analysisSessionId.value) return;

  const choice = await promptForSaveChoice({
    eyebrow: 'Orthanc Imports',
    title: 'Choose how to clear imported studies',
    message: 'You can clear only the studies imported into Orthanc for this dataset session, or remove the full dataset session everywhere.',
    options: [
      {
        value: 'orthanc-only',
        label: 'Clear Imported Studies',
        description: 'Remove only imported Orthanc studies and keep the saved dataset plus live dataset session.',
        recommended: true,
      },
      {
        value: 'remove-everywhere',
        label: 'Remove Dataset Everywhere',
        description: 'Remove the dataset from the saved registry, clear the live session, and clear imported Orthanc studies together.',
      },
    ],
  });

  if (!choice) {
    showActionInfo('Clear Imported Studies', 'Imported studies were not cleared.');
    return;
  }

  if (choice === 'remove-everywhere') {
    await clearCurrentSession({ skipPrompt: true });
    return;
  }

  importing.value = true;

  try {
    const response = await fetch('/api/viewer/clear-imported-studies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: analysisSessionId.value,
      }),
    });

    if (!response.ok) {
      throw new Error('Unable to clear imported studies');
    }

    viewerUrl.value = '';
    if (activeDataset.value) {
      await updateActiveDataset({
        status: {
          orthancImported: false,
        },
      });
    }
    await refreshUsageIndicators();
    addActivityLog(
      'Imported Studies Cleared',
      'Removed imported studies for the current session from local Orthanc.',
    );
    showActionSuccess('Clear Imported Studies', 'Imported studies were removed from local Orthanc. Review updated counts in Analytics & Activity.');
  } catch (error) {
    console.error(error);
    showActionError('Clear Imported Studies', 'Unable to clear imported studies from local Orthanc.');
  } finally {
    importing.value = false;
  }
}

async function clearCurrentSession(options = {}) {
  if (!analysisSessionId.value) return;

  if (!options.skipPrompt) {
    const choice = await promptForSaveChoice({
      eyebrow: 'Current Dataset Session',
      title: 'Choose what to keep before clearing this session',
      message: 'This action can either clear only the live session and keep the dataset saved, or remove the dataset everywhere from the local workspace.',
      options: [
        {
          value: 'save-dataset',
          label: 'Save Dataset',
          description: 'Keep the saved dataset record in the registry, but clear the live session and Orthanc imports for this session.',
          recommended: true,
        },
        {
          value: 'remove-everywhere',
          label: 'Remove Dataset Everywhere',
          description: 'Remove the saved dataset, clear the live session, clear browser session traces, and clear imported Orthanc studies.',
        },
      ],
    });

    if (!choice) {
      showActionInfo('Clear Session', 'The current analysis session was not cleared.');
      return;
    }

    options = {
      ...options,
      preserveSavedDataset: choice === 'save-dataset',
    };
  }

  importing.value = true;
  resetImportProgressState();
  const sessionIdToClear = analysisSessionId.value;
  const savedDataset = findDatasetBySessionId(sessionIdToClear);

  try {
    const response = await fetch('/api/viewer/clear-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: sessionIdToClear,
      }),
    });

    if (!response.ok) {
      throw new Error('Unable to clear session');
    }

    if (options.preserveSavedDataset && savedDataset) {
      await updateActiveDataset({
        sessionId: null,
        status: {
          sessionAvailable: false,
          orthancImported: false,
          staleSession: true,
        },
      });
      clearActiveDataset();
    } else {
      await removeDatasetBySessionId(sessionIdToClear);
      clearActiveDataset();
    }

    clearRecentLocationsForSession(sessionIdToClear);
    clearOpenedSelectionsForSession(sessionIdToClear);
    clearActivityLogForSession(sessionIdToClear);
    clearUsageIndicatorsForSession(sessionIdToClear);
    analysisSessionId.value = '';
    analysisSummary.value = null;
    ignoredFileSummary.value = null;
    showIgnoredFiles.value = false;
    treeRoot.value = null;
    currentPath.value = '';
    usageIndicators.value = null;
    viewerUrl.value = '';
    currentFolderEntries.value = [];
    currentFolderInfo.value = { folderCount: 0, fileCount: 0 };
    selectedInspectorItem.value = null;
    inspectorMetadataSummary.value = null;
    inspectorMetadataError.value = '';
    inspectorMetadataLoading.value = false;
    recentLocations.value = [];
    currentFolderControls.value = {
      page: 1,
      pageSize: 25,
      totalResults: 0,
      totalPages: 1,
    };
    folderSearchInput.value = defaultCurrentFolderControls.search;
    debouncedFolderSearch.value = defaultCurrentFolderControls.search;
    currentFolderSearchScope.value = defaultCurrentFolderControls.searchScope;
    currentFolderExtensionFilter.value = defaultCurrentFolderControls.extension;
    currentFolderSizeRange.value = defaultCurrentFolderControls.sizeRange;
    currentFolderSortBy.value = defaultCurrentFolderControls.sortBy;
    currentFolderSortDir.value = defaultCurrentFolderControls.sortDir;
    currentFolderPageSize.value = defaultCurrentFolderControls.pageSize;
    expandedPaths.value = new Set();
    clearRecentActiveSession();
    await refreshDatasetSelectorPage();
    await refreshWorkspaceDatasetManagementPage();
    window.history.replaceState({}, '', buildUrlForState({ sessionId: '' }));
    if (folderInput.value) {
      folderInput.value.value = '';
    }
    recentUploadSuccess.value = null;
    selectedFolderLabel.value = 'No dataset folder staged';
    datasetSourcePathInput.value = '';
    datasetSourcePathError.value = '';
    selectedDatasetSourcePath.value = '';
    navigateToPortalPage('dashboard');
    showActionSuccess(
      'Clear Session',
      options.preserveSavedDataset
        ? 'The live session was cleared, but the saved dataset remains in the registry for later recovery.'
        : 'The current analysis session was cleared. Upload another folder to continue.',
    );
  } catch (error) {
    console.error(error);
    showActionError('Clear Session', 'Unable to clear the current analysis session.');
  } finally {
    importing.value = false;
  }
}

async function fetchCurrentFolderResults() {
  if (!analysisSessionId.value || !treeRoot.value) {
    currentFolderEntries.value = [];
    currentFolderInfo.value = { folderCount: 0, fileCount: 0 };
    currentFolderGroupedData.value = {
      studyCount: 0,
      directFileCount: 0,
      studies: [],
    };
    currentFolderGroupedError.value = '';
    selectedInspectorItem.value = null;
    inspectorMetadataSummary.value = null;
    inspectorMetadataError.value = '';
    inspectorMetadataLoading.value = false;
    return;
  }

  currentFolderLoading.value = true;

  try {
    const searchParams = new URLSearchParams({
      sessionId: analysisSessionId.value,
      path: currentPath.value,
      search: debouncedFolderSearch.value,
      searchScope: currentFolderSearchScope.value,
      extension: currentFolderExtensionFilter.value,
      sizeRange: currentFolderSizeRange.value,
      sortBy: currentFolderSortBy.value,
      sortDir: currentFolderSortDir.value,
      page: String(currentFolderControls.value.page),
      pageSize: String(currentFolderPageSize.value),
    });

    const response = await fetch(`/api/viewer/current-folder?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to load current folder results');
    }

    const payload = await response.json();
    currentFolderEntries.value = payload.entries || [];
    currentFolderInfo.value = payload.currentFolder || { folderCount: 0, fileCount: 0 };
    currentFolderControls.value = payload.controls || {
      page: 1,
      pageSize: Number(currentFolderPageSize.value),
      totalResults: 0,
      totalPages: 1,
    };

    const availableKeys = new Set((payload.entries || []).map((entry) => getInspectorItemKey(entry)));
    if (
      selectedInspectorItem.value
      && !availableKeys.has(getInspectorItemKey(selectedInspectorItem.value))
    ) {
      selectedInspectorItem.value = null;
      inspectorMetadataSummary.value = null;
      inspectorMetadataError.value = '';
    }

    if (showGroupedFolderView.value) {
      await fetchCurrentFolderGroupedData();
    }
  } catch (error) {
    console.error(error);
  } finally {
    currentFolderLoading.value = false;
  }
}

async function fetchCurrentFolderGroupedData() {
  if (!analysisSessionId.value || !treeRoot.value || !showGroupedFolderView.value) {
    currentFolderGroupedData.value = {
      studyCount: 0,
      directFileCount: 0,
      studies: [],
    };
    currentFolderGroupedError.value = '';
    return;
  }

  currentFolderGroupedLoading.value = true;
  currentFolderGroupedError.value = '';

  try {
    const searchParams = new URLSearchParams({
      sessionId: analysisSessionId.value,
      path: currentPath.value,
    });
    const response = await fetch(`/api/viewer/current-folder-groups?${searchParams.toString()}`);
    if (!response.ok) {
      throw new Error('Unable to load grouped Current Folder view.');
    }

    currentFolderGroupedData.value = await response.json();
  } catch (error) {
    console.error(error);
    currentFolderGroupedError.value = 'Unable to load grouped Current Folder view.';
    currentFolderGroupedData.value = {
      studyCount: 0,
      directFileCount: 0,
      studies: [],
    };
  } finally {
    currentFolderGroupedLoading.value = false;
  }
}

</script>

<style>
:root {
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.app-shell[data-theme="light"] {
  --text-primary: #17212b;
  --text-secondary: #5b6770;
  --surface-main: rgba(255, 255, 255, 0.78);
  --surface-raised: #ffffff;
  --surface-muted: rgba(23, 33, 43, 0.05);
  --surface-hero: linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(241, 245, 247, 0.72));
  --border-color: rgba(23, 33, 43, 0.12);
  --accent-strong: #185b42;
  --accent-soft: rgba(24, 91, 66, 0.16);
  --topbar-bg: #08264f;
  --topbar-fg: #eff7ff;
  --topbar-muted: rgba(239, 247, 255, 0.72);
  --topbar-height: 5.85rem;
  --page-bg:
    radial-gradient(circle at top left, rgba(255, 209, 102, 0.35), transparent 25%),
    linear-gradient(160deg, #f7f3e8 0%, #e8efe8 45%, #d7e4f0 100%);
  color: var(--text-primary);
  background: var(--page-bg);
}

.app-shell[data-theme="dark"] {
  --text-primary: #eef3f8;
  --text-secondary: #a8b7c6;
  --surface-main: rgba(10, 19, 34, 0.84);
  --surface-raised: #10233e;
  --surface-muted: rgba(255, 255, 255, 0.05);
  --surface-hero: linear-gradient(145deg, rgba(10, 19, 34, 0.96), rgba(15, 36, 58, 0.84));
  --border-color: rgba(173, 197, 221, 0.16);
  --accent-strong: #7fd0af;
  --accent-soft: rgba(127, 208, 175, 0.18);
  --topbar-bg: #041225;
  --topbar-fg: #e8f2ff;
  --topbar-muted: rgba(232, 242, 255, 0.7);
  --topbar-height: 5.85rem;
  --page-bg:
    radial-gradient(circle at top left, rgba(24, 91, 66, 0.25), transparent 22%),
    linear-gradient(160deg, #07111f 0%, #0d1728 46%, #10233e 100%);
  color: var(--text-primary);
  background: var(--page-bg);
}

.app-shell {
  min-height: 100vh;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--topbar-bg);
  color: var(--topbar-fg);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  min-height: var(--topbar-height);
  z-index: 40;
  backdrop-filter: blur(16px);
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.sidebar-toggle {
  display: inline-grid;
  gap: 0.24rem;
  width: 2.5rem;
  height: 2.5rem;
  place-content: center;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0.85rem;
  background: rgba(255, 255, 255, 0.08);
  color: var(--topbar-fg);
  cursor: pointer;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.16);
}

.sidebar-toggle span {
  display: block;
  width: 1rem;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  background: transparent;
  color: inherit;
  border: 0;
  padding: 0;
}

.brand-grid {
  width: 2.2rem;
  height: 2.2rem;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.2rem;
}

.brand-grid span {
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: 0.35rem;
}

.brand-copy {
  display: flex;
  flex-direction: column;
}

.brand-copy small {
  color: var(--topbar-muted);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.topbar-status {
  color: var(--topbar-muted);
  font-size: 0.95rem;
}

.theme-toggle {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--topbar-fg);
  padding: 0.7rem 1rem;
  cursor: pointer;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.16);
}

button,
select,
input {
  font: inherit;
}

code {
  background: var(--surface-muted);
  border-radius: 0.35rem;
  padding: 0.1rem 0.35rem;
}

.page-shell {
  min-width: 0;
  width: 100%;
  padding: 2rem 0 3rem;
}

.portal-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  align-items: start;
  gap: 1.25rem;
  width: min(100%, 1440px);
  max-width: 1440px;
  margin: 0 auto;
}

.portal-shell.sidebar-collapsed {
  grid-template-columns: 92px minmax(0, 1fr);
}

.sidebar-overlay {
  position: fixed;
  inset: 0;
  z-index: 22;
  background: rgba(7, 16, 31, 0.34);
  backdrop-filter: blur(4px);
}

.portal-sidebar {
  position: sticky;
  top: calc(var(--topbar-height) + 0.65rem);
  margin: 2rem 0;
  padding: 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1.5rem;
  background: linear-gradient(180deg, var(--surface-main), var(--surface-muted));
  box-shadow: 0 18px 44px rgba(23, 33, 43, 0.08);
  transition: width 180ms ease, margin 180ms ease, transform 180ms ease, opacity 180ms ease;
  z-index: 8;
  max-height: calc(100vh - var(--topbar-height) - 1.5rem);
  overflow: auto;
}

.portal-sidebar-header h2,
.portal-sidebar-card strong {
  margin: 0;
}

.portal-sidebar-header p,
.portal-sidebar-card p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.portal-sidebar-kicker,
.portal-sidebar-label {
  display: block;
  margin-bottom: 0.45rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.portal-nav {
  display: grid;
  gap: 0.7rem;
  margin-top: 1.25rem;
}

.portal-nav-item {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  width: 100%;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  min-width: 0;
}

.portal-nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.65rem;
  height: 2.65rem;
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--surface-main) 74%, var(--accent-soft) 26%);
  color: var(--text-primary);
  flex: 0 0 auto;
  font-size: 1.15rem;
  line-height: 1;
}

.portal-nav-content {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
  flex: 1 1 auto;
}

.portal-nav-item small {
  display: block;
  color: var(--text-secondary);
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.portal-nav-item:hover:not(.active) {
  background: var(--accent-soft);
}

.portal-nav-item:hover:not(.active) .portal-nav-icon {
  background: color-mix(in srgb, var(--accent-soft) 55%, var(--surface-main) 45%);
}

.portal-nav-item.active {
  border-color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent-soft) 78%, white 22%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-soft) 55%, transparent 45%);
}

.portal-nav-item.active .portal-nav-icon {
  background: color-mix(in srgb, var(--accent-strong) 24%, white 76%);
  color: var(--accent-strong);
}

.portal-nav-title {
  font-weight: 700;
  line-height: 1.3;
}

.portal-sidebar-card {
  margin-top: 1rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-main);
}

.sidebar-collapsed .portal-sidebar {
  padding: 1rem 0.8rem;
}

.sidebar-collapsed .portal-sidebar-header p,
.sidebar-collapsed .portal-sidebar-header h2,
.sidebar-collapsed .portal-sidebar-card,
.sidebar-collapsed .portal-nav-item small {
  display: none;
}

.sidebar-collapsed .portal-nav-item {
  align-items: center;
  justify-content: center;
  min-height: 4.75rem;
  padding: 0.75rem 0.55rem;
  gap: 0;
  text-align: center;
}

.sidebar-collapsed .portal-nav-content {
  display: none;
}

.sidebar-collapsed .portal-nav-item.active {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-soft) 55%, transparent 45%);
}

.sidebar-collapsed .portal-nav-item .portal-nav-icon {
  width: 2.45rem;
  height: 2.45rem;
  border-radius: 0.85rem;
}

.hero-card,
.selection-card,
.hierarchy-card,
.analysis-card,
.viewer-card {
  background: var(--surface-main);
  border: 1px solid var(--border-color);
  border-radius: 1.5rem;
  box-shadow: 0 24px 60px rgba(23, 33, 43, 0.1);
  backdrop-filter: blur(18px);
  padding: 1.5rem;
}

.analysis-card,
.viewer-card {
  margin-top: 1.5rem;
}

.hero-card {
  background: var(--surface-hero);
}

.dashboard-page,
.about-page-card,
.empty-workspace-card,
.upload-page-card {
  margin-top: 0;
}

.dashboard-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin: 1.5rem 0 1rem;
}

.dashboard-summary-card {
  padding: 1rem 1.05rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
}

.dashboard-summary-card strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.05rem;
}

.dashboard-summary-card p {
  margin: 0.45rem 0 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.dashboard-card-label {
  display: block;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dashboard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.dashboard-highlight-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 1.25rem;
}

.confidence-strip {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-top: 1.25rem;
}

.confidence-card {
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--surface-raised) 88%, var(--accent-soft) 12%);
}

.confidence-card strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.05rem;
}

.confidence-card p {
  margin: 0.45rem 0 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.dashboard-highlight-card,
.dashboard-recent-card {
  padding: 1rem 1.05rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
}

.dashboard-highlight-card strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.08rem;
}

.dashboard-highlight-card p {
  margin: 0.45rem 0 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.dashboard-recent-card {
  margin-top: 1.25rem;
}

.upload-success-banner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 1.1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--accent-strong) 28%, var(--border-color) 72%);
  border-radius: 1.1rem;
  background: linear-gradient(145deg, color-mix(in srgb, var(--accent-soft) 22%, var(--surface-raised) 78%), var(--surface-raised));
}

.upload-success-banner h2 {
  margin: 0.2rem 0 0;
}

.upload-success-banner p {
  margin: 0.45rem 0 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.upload-success-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
  flex: 1 1 18rem;
}

.workspace-datasets-card {
  margin-bottom: 1.25rem;
}

.workspace-dataset-toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.9rem;
  align-items: end;
  margin-bottom: 1rem;
}

.workspace-dataset-search,
.workspace-dataset-sort {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.workspace-dataset-search-input {
  position: relative;
  min-width: 0;
}

.workspace-dataset-search span,
.workspace-dataset-sort span {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.workspace-dataset-search input,
.workspace-dataset-sort select {
  min-height: 2.9rem;
  border-radius: 0.95rem;
  border: 1px solid var(--border-color);
  padding: 0.8rem 0.95rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  font: inherit;
}

.workspace-dataset-search input {
  width: 100%;
  min-width: 0;
  padding-right: 3rem;
}

.workspace-dataset-search-clear {
  position: absolute;
  top: 50%;
  right: 0.8rem;
  transform: translateY(-50%);
  min-height: 2rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(219, 76, 69, 0.2);
  border-radius: 999px;
  background: #fff4f3;
  color: #a22e29;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.workspace-dataset-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.workspace-dataset-card {
  display: grid;
  gap: 0.95rem;
  padding: 1rem 1.05rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
}

.workspace-dataset-card.active {
  border-color: color-mix(in srgb, var(--accent-strong) 40%, var(--border-color) 60%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-strong) 16%, transparent);
}

.workspace-dataset-copy {
  min-width: 0;
}

.workspace-dataset-title-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.workspace-dataset-title-row strong {
  font-size: 1rem;
}

.workspace-dataset-copy p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.workspace-dataset-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.55rem;
}

.workspace-dataset-metadata span {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-main) 70%, var(--accent-soft) 30%);
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
}

.workspace-dataset-copy small {
  display: block;
  margin-top: 0.35rem;
  color: var(--text-secondary);
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.workspace-dataset-detail-grid {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.7rem;
  padding-top: 0.7rem;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
}

.workspace-dataset-detail-grid span {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.workspace-dataset-detail-grid strong {
  color: var(--text-primary);
}

.workspace-dataset-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  align-items: stretch;
}

.workspace-dataset-actions .secondary-action {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.75rem 0.85rem;
  white-space: normal;
  line-height: 1.25;
}

.danger-action {
  border-color: color-mix(in srgb, #db4c45 35%, var(--border-color) 65%);
  color: #a22e29;
}

.workspace-dataset-empty {
  padding: 1.05rem 1.1rem;
  border-radius: 1rem;
  border: 1px dashed var(--border-color);
  background: color-mix(in srgb, var(--surface-raised) 78%, var(--surface-main) 22%);
}

.workspace-dataset-empty strong {
  display: block;
  margin-bottom: 0.35rem;
}

.workspace-dataset-empty p {
  margin: 0;
  color: var(--text-secondary);
}

.dataset-selector-table-card {
  padding: 0;
}

.dataset-selector-name {
  display: grid;
  gap: 0.25rem;
}

.dataset-selector-name strong,
.dataset-selector-name small {
  overflow-wrap: anywhere;
}

.workspace-dataset-detail-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.workspace-dataset-detail-link:hover strong {
  color: var(--accent-strong);
}

.workspace-dataset-table .dataset-selector-name small {
  color: var(--text-secondary);
}

.workspace-dataset-actions-cell {
  width: 11rem;
  vertical-align: top;
}

.workspace-dataset-action-row td {
  padding: 0 0.7rem 1rem;
  background: linear-gradient(135deg, rgba(239, 247, 243, 0.92), rgba(255, 255, 255, 0.98));
}

.workspace-dataset-status-cell,
.workspace-dataset-signals-cell {
  min-width: 12rem;
}

.workspace-dataset-status-list,
.workspace-dataset-signal-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.workspace-dataset-expand-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 8.5rem;
  padding: 0.6rem 1rem;
  border: 1px solid rgba(30, 108, 78, 0.18);
  border-radius: 999px;
  background: rgba(233, 243, 238, 0.95);
  color: var(--accent-strong);
  font-weight: 700;
  transition: transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
}

.workspace-dataset-expand-button:hover:not(:disabled) {
  background: rgba(221, 238, 230, 0.98);
  box-shadow: 0 8px 20px rgba(26, 71, 52, 0.08);
  transform: translateY(-1px);
}

.workspace-dataset-action-menu {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  max-height: 18rem;
  padding: 0.9rem;
  border: 1px solid rgba(30, 108, 78, 0.14);
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78), 0 14px 28px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
  overflow: hidden;
  transform-origin: top center;
}

.workspace-dataset-menu-enter-active,
.workspace-dataset-menu-leave-active {
  transition: max-height 220ms ease, opacity 180ms ease, transform 220ms ease, margin-top 220ms ease, padding-block 220ms ease;
}

.workspace-dataset-menu-enter-from,
.workspace-dataset-menu-leave-to {
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  opacity: 0;
  transform: translateY(-0.35rem) scaleY(0.98);
}

.workspace-dataset-menu-item {
  min-height: 4.35rem;
  border: 1px solid rgba(30, 108, 78, 0.15);
  border-radius: 0.8rem;
  background: var(--surface-main);
  color: var(--text-primary);
  font: inherit;
  font-weight: 700;
  text-align: center;
  padding: 0.85rem 1rem;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
  transition: transform 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.workspace-dataset-menu-item:hover:not(:disabled) {
  background: var(--accent-soft);
  border-color: rgba(30, 108, 78, 0.28);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.09);
  transform: translateY(-1px);
}

.workspace-dataset-menu-item.danger {
  color: #9f2d26;
}

.workspace-dataset-menu-item.danger:hover:not(:disabled) {
  background: rgba(254, 236, 234, 0.98);
  border-color: rgba(159, 45, 38, 0.22);
}

.workspace-dataset-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dataset-detail-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem 1rem;
}

.dataset-detail-summary-grid span {
  display: block;
  padding: 0.72rem 0.82rem;
  border: 1px solid rgba(30, 108, 78, 0.1);
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.dataset-detail-summary-grid strong {
  color: var(--text-primary);
}

.dataset-detail-actions-section {
  margin-top: 1.35rem;
  padding-top: 1.15rem;
  border-top: 1px solid rgba(30, 108, 78, 0.12);
}

.dataset-detail-actions-card {
  margin-top: 1.15rem;
  border-color: rgba(30, 108, 78, 0.16);
  background: linear-gradient(180deg, rgba(238, 246, 241, 0.96), rgba(248, 251, 249, 0.98));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.dataset-detail-actions-copy h2 {
  margin: 0;
}

.dataset-detail-actions-copy p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
}

.dataset-detail-actions {
  display: grid;
  margin-top: 1.1rem;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.dataset-detail-actions .secondary-action,
.dataset-detail-actions .danger-action {
  min-height: 3.35rem;
  background: rgba(255, 255, 255, 0.92);
}

.dataset-detail-actions .danger-action {
  background: rgba(255, 245, 244, 0.98);
  border-color: rgba(194, 67, 67, 0.2);
}

.dataset-detail-actions .danger-action:hover:not(:disabled) {
  background: rgba(254, 236, 234, 0.98);
}

.dataset-action-item {
  border: 1px solid transparent;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--surface-main) 90%, var(--accent-soft) 10%);
  color: var(--text-primary);
  font: inherit;
  padding: 0.65rem 0.75rem;
  text-align: left;
  cursor: pointer;
}

.dataset-action-item.danger {
  color: #a22e29;
  background: #fff5f4;
}

.workspace-dataset-badge {
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-soft) 65%, var(--surface-main) 35%);
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 700;
}

.workspace-dataset-badge.active {
  background: rgba(231, 244, 255, 0.96);
  color: #175282;
}

.workspace-dataset-badge.live {
  background: rgba(230, 247, 238, 0.96);
  color: #175c39;
}

.workspace-dataset-badge.stale {
  background: rgba(255, 241, 232, 0.96);
  color: #9a4a0f;
}

.workspace-dataset-badge.imported {
  background: rgba(245, 236, 255, 0.96);
  color: #6d28a8;
}

.workspace-dataset-badge.ignored {
  background: rgba(240, 244, 248, 0.96);
  color: #44556b;
}

.workspace-dataset-badge.recent {
  background: rgba(255, 248, 219, 0.98);
  color: #8a5a00;
}

.upload-workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 1.25rem;
  margin-top: 1.5rem;
}

.upload-primary-panel,
.upload-helper-card {
  padding: 1.1rem 1.15rem;
  border: 1px solid var(--border-color);
  border-radius: 1.1rem;
  background: var(--surface-raised);
}

.upload-primary-panel {
  position: relative;
}

.upload-primary-panel.upload-drag-active {
  outline: 2px dashed var(--accent-strong);
  outline-offset: 0.4rem;
}

.upload-drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid color-mix(in srgb, var(--accent-strong) 45%, var(--border-color) 55%);
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--surface-main) 72%, var(--accent-soft) 28%);
  color: var(--text-primary);
  padding: 1.25rem;
  text-align: center;
  pointer-events: none;
  z-index: 2;
}

.upload-drop-overlay strong {
  font-size: 1.05rem;
}

.upload-drop-overlay span {
  color: var(--text-secondary);
  max-width: 28rem;
}

.upload-panel-header h2,
.upload-helper-card strong {
  margin: 0;
}

.upload-panel-header p,
.upload-helper-card p {
  margin: 0.45rem 0 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.upload-controls {
  margin-bottom: 1.25rem;
}

.upload-status-strip {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.upload-status-item {
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-main);
}

.upload-status-item strong {
  display: block;
  margin-top: 0.25rem;
}

.upload-privacy-note {
  margin-top: 1.15rem;
}

.page-inline-note {
  margin-top: 1rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.workspace-guardrail-note {
  border-left: 3px solid var(--border-color);
  padding-left: 0.85rem;
}

.workspace-guardrail-note.warning {
  border-left-color: color-mix(in srgb, var(--warning) 70%, var(--border-color) 30%);
}

.workspace-guardrail-note.elevated {
  border-left-color: color-mix(in srgb, var(--danger) 72%, var(--border-color) 28%);
}

.workspace-guardrail-note strong {
  color: var(--text-primary);
}

.viewer-mode-note {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.viewer-mode-note strong {
  color: var(--text-primary);
}

.inline-page-link {
  display: inline;
  margin-left: 0.2rem;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--accent-strong);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 0.16em;
}

.upload-side-panel {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.upload-steps-list {
  margin: 0.85rem 0 0;
  padding-left: 1.1rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.upload-ready-card {
  border-color: color-mix(in srgb, var(--accent-strong) 28%, var(--border-color) 72%);
  background: linear-gradient(145deg, var(--surface-raised), color-mix(in srgb, var(--accent-soft) 20%, var(--surface-raised) 80%));
}

.dashboard-opened-list {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.9rem;
}

.dashboard-dataset-list {
  display: grid;
  gap: 0.85rem;
  margin-top: 0.95rem;
}

.dashboard-dataset-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 0.95rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-main);
}

.dashboard-dataset-copy {
  display: grid;
  gap: 0.2rem;
}

.dashboard-dataset-copy strong {
  display: block;
}

.dashboard-dataset-copy span,
.dashboard-dataset-copy small {
  color: var(--text-secondary);
}

.dashboard-dataset-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.dashboard-opened-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--border-color);
  border-radius: 0.95rem;
  background: var(--surface-main);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.dashboard-opened-item:hover {
  background: var(--accent-soft);
}

.dashboard-opened-item strong {
  display: block;
}

.dashboard-opened-item span {
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.dashboard-activity-card {
  margin-top: 1.25rem;
}

.about-page-panel {
  margin-bottom: 0;
}

.eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent-strong);
}

h1,
h2 {
  margin: 0;
}

.intro,
.privacy-note {
  max-width: 60rem;
  line-height: 1.6;
}

.portal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0 0;
  padding: 0.95rem 0.2rem 0.25rem;
  color: var(--text-secondary);
  font-size: 0.94rem;
}

.portal-footer-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--accent-strong);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 1.5rem 0 1rem;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 950;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(10, 19, 37, 0.4);
  backdrop-filter: blur(6px);
}

.upload-guide-modal {
  width: min(560px, 100%);
  padding: 1.5rem 1.6rem;
  border: 1px solid var(--border-color);
  border-radius: 1.25rem;
  background: var(--surface-main);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22);
}

.upload-guide-modal p {
  color: var(--text-secondary);
  line-height: 1.6;
}

.upload-guide-list {
  margin: 1rem 0 0;
  padding-left: 1.15rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.upload-guide-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.duplicate-upload-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.save-choice-modal {
  width: min(720px, 100%);
}

.save-choice-options {
  display: grid;
  gap: 0.9rem;
  margin-top: 1.1rem;
}

.save-choice-option {
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 1rem 1.05rem;
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: 0.35rem;
}

.save-choice-option strong {
  font-size: 1rem;
}

.save-choice-option span {
  color: var(--text-secondary);
  line-height: 1.5;
}

.save-choice-option:hover {
  background: var(--accent-soft);
}

.save-choice-option.recommended {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.resume-session-card {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-top: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-muted);
}

.resume-session-card p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
}

.resume-session-label {
  font-weight: 700;
  color: var(--text-primary);
}

.file-picker,
.toggle,
.upload-source-path-field {
  display: inline-flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 220px;
}

.file-picker span,
.toggle span,
.upload-source-path-field span,
.stat-label {
  font-size: 0.9rem;
  font-weight: 600;
}

.file-picker input,
.toggle select,
.upload-source-path-field input {
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.8rem 1rem;
}

.upload-source-path-field {
  margin-top: 1rem;
}

.upload-source-path-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.upload-source-path-status {
  color: var(--accent-strong);
  font-size: 0.92rem;
  font-weight: 600;
}

.upload-source-path-field small {
  color: var(--text-secondary);
  line-height: 1.45;
}

.upload-source-path-guidance {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.upload-source-path-guidance.error {
  color: #b42318;
}

.sr-only-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.file-picker-button {
  min-height: 3.2rem;
  border: 1px solid var(--border-color);
  border-radius: 0.95rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.8rem 1rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.file-picker-button:hover:not(:disabled) {
  background: var(--accent-soft);
}

.file-picker-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.file-picker-status {
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.stats {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  margin-bottom: 1.25rem;
}

.datasets-workspace {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  align-items: start;
}

.datasets-primary-column,
.datasets-support-column {
  display: grid;
  gap: 1rem;
  align-content: start;
  min-width: 0;
}

.analytics-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  margin-top: 1.5rem;
  align-items: start;
}

.analytics-primary-column,
.analytics-support-column {
  display: grid;
  gap: 1rem;
  align-content: start;
  min-width: 0;
}

.analytics-summary-card strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.05rem;
}

.analytics-summary-card p {
  margin: 0.45rem 0 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.analytics-confidence-strip {
  margin-top: 0;
}

.datasets-focus-card {
  padding: 1.15rem 1.2rem;
  border: 1px solid color-mix(in srgb, var(--accent-strong) 18%, var(--border-color) 82%);
  border-radius: 1.1rem;
  background: linear-gradient(145deg, var(--surface-main), color-mix(in srgb, var(--accent-soft) 16%, var(--surface-main) 84%));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.datasets-focus-copy h2 {
  margin: 0.2rem 0 0.45rem;
}

.datasets-focus-copy p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.datasets-stats {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.stats strong {
  display: block;
  margin-top: 0.2rem;
  font-size: 1.4rem;
}

.ignored-files-card {
  margin-bottom: 1.25rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-muted);
}

.ignored-files-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.ignored-files-header h3 {
  margin: 0;
}

.ignored-files-header p,
.ignored-files-copy {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
}

.ignored-files-toggle {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.55rem 0.9rem;
  cursor: pointer;
}

.ignored-files-types {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.9rem;
}

.ignored-files-chip {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-secondary);
  padding: 0.45rem 0.75rem;
  font-size: 0.92rem;
}

.ignored-files-details {
  margin-top: 0.95rem;
}

.ignored-files-list {
  margin: 0.6rem 0 0;
  padding-left: 1.2rem;
  color: var(--text-secondary);
}

.breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.selection-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.breadcrumb,
.node-card,
.primary {
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.breadcrumb {
  padding: 0.55rem 0.85rem;
  background: var(--surface-muted);
  color: var(--text-primary);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.primary {
  background: var(--accent-strong);
  color: #fff;
  padding: 0.85rem 1.2rem;
}

.primary:disabled {
  opacity: 0.6;
  cursor: wait;
}

.selection-card,
.hierarchy-card {
  margin-top: 0;
}

.lifecycle-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem 1.15rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-muted);
}

.usage-card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-muted);
}

.usage-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.usage-header h3 {
  margin: 0;
}

.usage-header p,
.usage-note {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
}

.usage-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-top: 0.95rem;
}

.usage-item {
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: var(--surface-main);
}

.usage-item span {
  display: block;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.lifecycle-card h3 {
  margin: 0 0 0.35rem;
}

.lifecycle-card p {
  margin: 0;
  max-width: 48rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.lifecycle-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-end;
}

.activity-log-card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-muted);
}

.help-card {
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-muted);
}

.help-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.help-header h3 {
  margin: 0;
}

.help-header p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
}

.help-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 0.95rem;
}

.help-item {
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: var(--surface-main);
}

.help-item span {
  display: block;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.help-item p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.activity-log-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.activity-log-header h3 {
  margin: 0;
}

.activity-log-header p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
}

.activity-log-list {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.95rem;
}

.activity-log-entry {
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: var(--surface-main);
}

@media (max-width: 1460px) {
  .datasets-workspace,
  .analytics-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.activity-log-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
}

.activity-log-meta span {
  color: var(--text-secondary);
  font-size: 0.85rem;
  white-space: nowrap;
}

.activity-log-entry p {
  margin: 0.45rem 0 0;
  color: var(--text-secondary);
}

.secondary-action {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.7rem 1rem;
  cursor: pointer;
}

.secondary-action:hover:not(:disabled) {
  background: var(--accent-soft);
}

.secondary-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.selection-card-header,
.hierarchy-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.selection-card-header > div:first-child,
.hierarchy-header > div:first-child {
  flex: 1 1 24rem;
  min-width: 0;
}

.selection-card-header p,
.hierarchy-header p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
}

.selection-card-meta {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.view-mode-field {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.view-mode-field select {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.3rem 0.7rem;
}

.recent-locations-card {
  margin-bottom: 1rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-muted);
}

.recent-locations-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.6rem;
  align-items: baseline;
}

.recent-locations-header span {
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.recent-location-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.85rem;
  min-width: 0;
}

.recent-location-button {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.55rem 0.9rem;
  cursor: pointer;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.recent-location-button:hover:not(:disabled) {
  background: var(--accent-soft);
}

.recent-location-button.active {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.recent-location-button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.folder-toolbar {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin-bottom: 0.85rem;
}

.searchbox,
.toolbar-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  justify-content: flex-end;
  min-width: 0;
}

.searchbox {
  position: relative;
}

.searchbox input,
.toolbar-field select {
  border: 1px solid var(--border-color);
  border-radius: 0.95rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.8rem 1rem;
  width: 100%;
  min-width: 0;
}

.searchbox input {
  padding-left: 2.7rem;
  padding-right: 2.7rem;
  min-height: 3.55rem;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: calc(50% + 0.45rem);
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 1.15rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.search-icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

.clear-search {
  position: absolute;
  right: 0.85rem;
  top: calc(50% + 0.45rem);
  transform: translateY(-50%);
  width: 1.65rem;
  height: 1.65rem;
  border: 0;
  border-radius: 999px;
  background: #d94141;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.clear-search svg {
  width: 0.8rem;
  height: 0.8rem;
}

.clear-search:hover:not(:disabled) {
  background: #bf3030;
}

.clear-search:disabled {
  opacity: 0.55;
  cursor: wait;
}

.toolbar-field span {
  color: var(--text-secondary);
  font-size: 0.88rem;
  font-weight: 600;
}

.reset-button {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.35rem 0.8rem;
  cursor: pointer;
}

.reset-button:hover:not(:disabled) {
  background: var(--accent-soft);
}

.reset-button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.folder-toolbar-summary {
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.toast-stack {
  position: fixed;
  bottom: 1.2rem;
  right: 1.2rem;
  z-index: 1000;
  display: grid;
  gap: 0.75rem;
  width: min(360px, calc(100vw - 2rem));
}

.toast {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  border: 1px solid transparent;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(14px);
}

.toast-success {
  background: rgba(230, 247, 238, 0.96);
  border-color: rgba(63, 145, 97, 0.28);
  color: #164e2f;
}

.toast-error {
  background: rgba(254, 237, 237, 0.97);
  border-color: rgba(198, 67, 67, 0.24);
  color: #7f1d1d;
}

.toast-info {
  background: rgba(236, 244, 255, 0.97);
  border-color: rgba(59, 107, 194, 0.22);
  color: #183b73;
}

.toast-copy {
  min-width: 0;
}

.toast-copy strong {
  display: block;
  font-size: 0.96rem;
}

.toast-copy p {
  margin: 0.3rem 0 0;
  line-height: 1.45;
}

.toast-dismiss {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.1rem;
}

.ui-notice {
  margin-bottom: 1rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.active-filters-card {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}

.active-filters-label {
  color: var(--text-secondary);
  font-size: 0.92rem;
  font-weight: 700;
}

.active-filters-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.active-filter-chip {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.5rem 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
}

.active-filter-chip svg {
  width: 0.7rem;
  height: 0.7rem;
  flex: 0 0 auto;
}

.active-filter-chip:hover:not(:disabled) {
  background: var(--accent-soft);
}

.active-filter-chip:disabled {
  opacity: 0.55;
  cursor: wait;
}

.inspector-card {
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: linear-gradient(145deg, var(--surface-raised), var(--surface-muted));
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
}

.inspector-header h3 {
  margin: 0.2rem 0 0;
}

.inspector-eyebrow {
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.inspector-dismiss {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--text-primary);
  padding: 0.45rem 0.8rem;
  cursor: pointer;
}

.inspector-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 0.85rem;
  color: var(--text-secondary);
  font-size: 0.94rem;
}

.inspector-details {
  margin-top: 1rem;
}

.inspector-copy-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.85rem;
}

.copy-action {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-main);
  color: var(--text-primary);
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}

.copy-action:hover {
  background: var(--accent-soft);
}

.inspector-loading,
.inspector-error {
  margin: 0;
  color: var(--text-secondary);
}

.inspector-error {
  color: #c14343;
}

.inspector-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.inspector-detail {
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: var(--surface-main);
}

.inspector-detail span {
  display: block;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.inspector-detail strong {
  display: block;
  overflow-wrap: anywhere;
}

.inspector-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.inspector-primary {
  padding: 0.7rem 1rem;
}

.grouped-view-card {
  margin-bottom: 1rem;
  padding: 1rem 1.15rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-muted);
}

.grouped-view-header p,
.group-meta {
  margin: 0;
}

.grouped-view-header span,
.group-meta,
.group-label {
  color: var(--text-secondary);
}

.grouped-view-empty {
  color: var(--text-secondary);
}

.study-group-list,
.series-group-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  margin-top: 0.9rem;
}

.study-group-card,
.series-group-card {
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
  padding: 0.95rem 1rem;
}

.study-group-header,
.series-group-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
}

.group-label {
  display: block;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}

.grouped-file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.85rem;
}

.table-view-card {
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-muted);
}

.table-view-header p {
  margin: 0 0 0.9rem;
  color: var(--text-secondary);
}

.table-scroll {
  overflow-x: auto;
  max-width: 100%;
}

.current-folder-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}

.current-folder-table th,
.current-folder-table td {
  padding: 0.8rem 0.7rem;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
  vertical-align: top;
}

.current-folder-table th {
  color: var(--text-secondary);
  font-size: 0.86rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.current-folder-table tbody tr.selected {
  background: var(--accent-soft);
}

.table-name-button,
.table-action-button {
  border: 0;
  background: transparent;
  color: var(--text-primary);
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.table-name-button {
  font-weight: 700;
}

.table-action-button {
  color: var(--accent-strong);
}

.hierarchy-note {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.node-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.node-card {
  text-align: left;
  padding: 1rem;
  background: linear-gradient(145deg, var(--surface-raised), var(--surface-muted));
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.node-card.selected,
.file-button.selected,
.search-result-item.selected {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.node-type-badge,
.file-type-badge {
  align-self: flex-start;
  border-radius: 999px;
  padding: 0.18rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.node-name {
  display: block;
  font-weight: 700;
}

.node-meta {
  display: block;
  color: var(--text-secondary);
}

.node-submeta,
.search-result-meta,
.file-copy small {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.file-list {
  grid-column: 1 / -1;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  background: var(--surface-muted);
}

.search-results-card {
  grid-column: 1 / -1;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  background: var(--surface-muted);
}

.search-result-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 0.9rem;
}

.search-result-item {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.8rem 1rem;
  text-align: left;
}

.search-result-type {
  min-width: 4.2rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 700;
  padding-top: 0.35rem;
}

.search-result-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.65rem;
  flex: 1;
}

.search-result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.search-result-breadcrumb-button {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.search-result-breadcrumb-button:hover .search-result-breadcrumb {
  color: var(--accent-strong);
}

.search-result-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.search-result-file-button {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-primary);
  padding: 0.5rem 0.85rem;
  cursor: pointer;
}

.search-result-file-button:hover:not(:disabled) {
  background: var(--accent-soft);
}

.search-result-file-button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.search-breadcrumb-part {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.search-crumb-button {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.search-crumb-button:hover {
  color: var(--accent-strong);
}

.search-breadcrumb-sep {
  color: var(--text-secondary);
}

.file-list-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
}

.file-list-header p {
  margin: 0;
}

.file-list-note {
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.file-button-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.9rem;
}

.file-button {
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.55rem 0.85rem;
  cursor: pointer;
  text-align: left;
  display: inline-flex;
  align-items: flex-start;
  gap: 0.7rem;
}

.file-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.file-button:hover:not(:disabled) {
  background: var(--accent-soft);
}

.file-button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px dashed var(--border-color);
  color: var(--text-secondary);
  background: transparent;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.pagination-copy {
  color: var(--text-secondary);
}

.pagination-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  justify-content: flex-end;
}

.pagination-button {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.65rem 1rem;
  cursor: pointer;
}

.pagination-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-goto {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.pagination-goto-label {
  color: var(--text-secondary);
  font-size: 0.92rem;
  font-weight: 600;
}

.pagination-input {
  width: 4.5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.8rem;
  background: var(--surface-main);
  color: var(--text-primary);
  padding: 0.55rem 0.7rem;
}

.pagination-go-button {
  padding-inline: 0.85rem;
}

.pagination-guidance {
  margin: 0.65rem 0 0;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.pagination-guidance.error {
  color: #c14343;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.viewer-copy {
  margin: 0.4rem 0 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.viewer-header-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
}

iframe {
  width: 100%;
  min-height: 75vh;
  border: 0;
  border-radius: 1rem;
  background: #111;
}

@media (max-width: 700px) {
  .topbar,
  .topbar-actions,
  .lifecycle-card,
  .selection-card-header,
  .hierarchy-header,
  .pagination-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .folder-toolbar {
    grid-template-columns: 1fr;
  }

  .inspector-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-shell {
    padding: 1rem 0.8rem 2rem;
  }

  .portal-shell {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .upload-workspace-grid {
    grid-template-columns: 1fr;
  }

  .upload-success-banner,
  .upload-success-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-dataset-toolbar {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .workspace-dataset-expanded-header {
    flex-direction: column;
  }

  .workspace-dataset-collapse-button,
  .workspace-dataset-expand-button {
    width: 100%;
    justify-content: center;
  }

  .workspace-dataset-expanded-summary,
  .workspace-dataset-expanded-actions {
    grid-template-columns: 1fr;
  }

  .workspace-dataset-card {
    flex-direction: column;
  }

  .workspace-dataset-actions {
    width: 100%;
    min-width: 0;
    grid-template-columns: 1fr;
  }

  .portal-sidebar {
    position: fixed;
    top: calc(var(--topbar-height) + 0.2rem);
    left: 0.8rem;
    bottom: 0.8rem;
    width: min(320px, calc(100vw - 1.6rem));
    margin: 0;
    transform: translateX(-115%);
    overflow: auto;
    z-index: 30;
  }

  .portal-sidebar.open {
    transform: translateX(0);
  }

  .toast-stack {
    bottom: 0.9rem;
    right: 0.9rem;
    width: min(320px, calc(100vw - 1.2rem));
  }

  .hero-card,
  .selection-card,
  .hierarchy-card,
  .analysis-card,
  .viewer-card {
    padding: 1rem;
    border-radius: 1.1rem;
  }

  .viewer-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .viewer-header-actions {
    justify-content: flex-start;
  }

  .upload-guide-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .portal-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
/* ============================================================
   NEW UI — Dashboard Page CSS
   ============================================================ */

.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dashboard-page h1 {
  margin: 0 0 0.35rem;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.dashboard-page .intro {
  margin: 0;
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.55;
}

.dashboard-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.dashboard-summary-card {
  padding: 1.1rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--border-color) 55%, var(--accent-strong) 45%);
  border-radius: 1.1rem;
  background: var(--surface-raised);
  transition: box-shadow 200ms ease, transform 200ms ease, border-color 200ms ease;
  cursor: default;
}

.dashboard-summary-card:hover {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-strong) 42%, transparent), var(--card-hover-shadow);
  border-color: var(--accent-strong);
  transform: translateY(-3px);
}

.dashboard-card-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}

.dashboard-summary-card strong {
  display: block;
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.dashboard-summary-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.5;
}

.dashboard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.confidence-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.85rem;
}

.confidence-card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
  transition: box-shadow 180ms ease, border-color 180ms ease;
}

.confidence-card:hover {
  box-shadow: var(--card-hover-shadow);
  border-color: var(--card-hover-border);
}

.confidence-card strong {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0.2rem 0 0.3rem;
  letter-spacing: -0.02em;
}

.confidence-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.83rem;
  line-height: 1.45;
}

.dashboard-recent-card {
  padding: 1.15rem 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: 1.2rem;
  background: var(--surface-raised);
}

.activity-log-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.activity-log-header h3 {
  margin: 0 0 0.2rem;
  font-size: 1rem;
  font-weight: 700;
}

.activity-log-header p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
}

.dashboard-dataset-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.dashboard-dataset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--surface-muted) 40%, transparent);
  transition: background 160ms ease, border-color 160ms ease;
}

.dashboard-dataset-item:hover {
  background: color-mix(in srgb, var(--accent-soft) 60%, var(--surface-muted) 40%);
  border-color: color-mix(in srgb, var(--accent-strong) 22%, var(--border-color));
}

.dashboard-dataset-copy {
  min-width: 0;
  flex: 1;
}

.dashboard-dataset-copy strong {
  display: block;
  font-size: 0.93rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.dashboard-dataset-copy span {
  display: block;
  color: var(--text-secondary);
  font-size: 0.82rem;
  overflow-wrap: anywhere;
  margin-top: 0.1rem;
}

.dashboard-dataset-copy small {
  display: block;
  color: var(--text-secondary);
  font-size: 0.78rem;
  margin-top: 0.15rem;
}

.dashboard-dataset-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.dashboard-highlight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.85rem;
}

.dashboard-highlight-card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--surface-raised);
}

.dashboard-highlight-card strong {
  display: block;
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0.2rem 0 0.3rem;
  letter-spacing: -0.02em;
  color: var(--accent-strong);
}

.dashboard-highlight-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.83rem;
  line-height: 1.45;
}

.dashboard-opened-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dashboard-opened-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.7rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--surface-muted) 40%, transparent);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.dashboard-opened-item:hover {
  background: color-mix(in srgb, var(--accent-soft) 60%, var(--surface-muted) 40%);
  border-color: color-mix(in srgb, var(--accent-strong) 22%, var(--border-color));
}

.dashboard-opened-item strong {
  display: block;
  font-size: 0.93rem;
  font-weight: 700;
}

.dashboard-opened-item span {
  display: block;
  color: var(--text-secondary);
  font-size: 0.82rem;
  margin-top: 0.1rem;
}

.activity-log-card {
  padding: 1.15rem 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: 1.2rem;
  background: var(--surface-raised);
}

.dashboard-activity-card { margin-top: 0; }

.activity-log-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.activity-log-entry {
  padding: 0.7rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--surface-muted) 40%, transparent);
}

.activity-log-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  flex-wrap: wrap;
}

.activity-log-meta strong { font-size: 0.9rem; font-weight: 700; }

.activity-log-meta span {
  font-size: 0.78rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.activity-log-entry p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* ============================================================
   NEW UI — Analytics Page CSS
   ============================================================ */

.analytics-page-card { display: flex; flex-direction: column; gap: 1.5rem; }

.analytics-grid {
  display: grid;
  grid-template-columns: 1fr minmax(280px, 320px);
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 860px) {
  .analytics-grid { grid-template-columns: 1fr; }
}

.analytics-primary-column,
.analytics-support-column { display: flex; flex-direction: column; gap: 1.25rem; }

.analytics-confidence-strip { grid-template-columns: repeat(2, 1fr); }

.usage-card, .lifecycle-card, .ignored-files-card {
  padding: 1.15rem 1.25rem;
  border: 1px solid var(--border-color);
  border-radius: 1.2rem;
  background: var(--surface-raised);
}

.usage-header, .ignored-files-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.usage-header h3, .ignored-files-header h3, .lifecycle-card h3 {
  margin: 0 0 0.2rem;
  font-size: 1rem;
  font-weight: 700;
}

.usage-header p, .ignored-files-header p, .lifecycle-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.65rem;
}

.usage-item {
  padding: 0.7rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--surface-muted) 45%, transparent);
}

.usage-item span {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 0.3rem;
}

.usage-item strong { display: block; font-size: 1.15rem; font-weight: 700; }

.usage-note {
  margin: 0.75rem 0 0;
  font-size: 0.83rem;
  color: var(--text-secondary);
  font-style: italic;
}

.lifecycle-card { display: flex; flex-direction: column; gap: 1rem; }

.lifecycle-actions { display: flex; flex-direction: column; gap: 0.6rem; }

.analytics-summary-card { margin-top: 0; }

.ignored-files-header { margin-bottom: 0.85rem; }

.ignored-files-toggle {
  flex-shrink: 0;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.ignored-files-toggle:hover { background: var(--surface-muted); border-color: var(--accent-strong); }

.ignored-files-types { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }

.ignored-files-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--surface-muted);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.ignored-files-details {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
}

.ignored-files-copy { margin: 0 0 0.45rem; font-size: 0.83rem; color: var(--text-secondary); font-weight: 600; }

.ignored-files-list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.65;
  overflow-wrap: anywhere;
}

/* ============================================================
   NEW UI — Smooth page-switch fade
   ============================================================ */

@keyframes page-fade-in {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}

.hero-card, .analysis-card, .selection-card {
  animation: page-fade-in 0.2s ease both;
}
</style>
