<template>
  <section v-if="false" class="selection-card workspace-datasets-card">
    <div class="selection-card-header">
      <div>
        <h2>Workspace Datasets</h2>
        <p>Search, reopen, and switch between saved datasets in this local browser workspace.</p>
      </div>
      <div class="selection-card-meta">
        <span>{{ savedDatasetCount }} dataset{{ savedDatasetCount === 1 ? '' : 's' }} saved</span>
        <span v-if="datasetListSearchInput.trim()">
          {{ workspaceDatasets.length }} match{{ workspaceDatasets.length === 1 ? '' : 'es' }}
        </span>
      </div>
    </div>

    <div class="workspace-dataset-toolbar">
      <label class="workspace-dataset-search">
        <span>Search datasets</span>
        <div class="workspace-dataset-search-input">
          <input
            :value="datasetListSearchInput"
            type="text"
            placeholder="Search by label, source, path, or current location"
            @input="$emit('update:dataset-list-search-input', $event.target.value)"
          />
          <button
            v-if="datasetListSearchInput.trim()"
            type="button"
            class="workspace-dataset-search-clear"
            aria-label="Clear dataset search"
            @click="$emit('clear-dataset-list-search')"
          >
            ×
          </button>
        </div>
      </label>
      <label class="workspace-dataset-sort">
        <span>Sort</span>
        <select :value="datasetListSortMode" @change="$emit('update:dataset-list-sort-mode', $event.target.value)">
          <option value="recent">Recently opened</option>
          <option value="label">Label</option>
          <option value="source">Source</option>
        </select>
      </label>
    </div>

    <div v-if="workspaceDatasets.length > 0" class="workspace-dataset-list">
      <article
        v-for="dataset in workspaceDatasets"
        :key="dataset.id"
        class="workspace-dataset-card"
        :class="{ active: dataset.id === activeDatasetId }"
      >
        <div class="workspace-dataset-copy">
          <div class="workspace-dataset-title-row">
            <strong>{{ dataset.label }}</strong>
            <span v-if="dataset.id === activeDatasetId" class="workspace-dataset-badge">Active</span>
          </div>
          <p>{{ dataset.sourceLabel || dataset.sourcePath || 'Unnamed dataset source' }}</p>
          <div class="workspace-dataset-metadata">
            <span>{{ dataset.summary?.selectedFiles || 0 }} selected</span>
            <span>{{ dataset.summary?.dicomFiles || 0 }} DICOM</span>
            <span>{{ dataset.summary?.ignoredFileCount || 0 }} ignored</span>
          </div>
          <small>
            {{ dataset.summary?.dicomFiles || 0 }} DICOM file{{ (dataset.summary?.dicomFiles || 0) === 1 ? '' : 's' }}
            across {{ dataset.summary?.folderCount || 0 }} folder{{ (dataset.summary?.folderCount || 0) === 1 ? '' : 's' }}
          </small>
          <small v-if="dataset.currentPath">
            Last location: {{ dataset.currentPath }}
          </small>
          <small v-if="dataset.sourcePath">
            Source path: {{ dataset.sourcePath }}
          </small>
        </div>
        <div class="workspace-dataset-actions">
          <button
            type="button"
            class="secondary-action"
            :disabled="datasetSwitchLoadingId === dataset.id"
            @click="$emit('open-workspace-dataset', dataset.id)"
          >
            {{
              datasetSwitchLoadingId === dataset.id
                ? 'Opening...'
                : dataset.id === activeDatasetId
                  ? 'Open Active'
                  : 'Open Dataset'
            }}
          </button>
          <button
            type="button"
            class="secondary-action"
            :disabled="datasetSwitchLoadingId === dataset.id"
            @click="$emit('open-workspace-dataset-analytics', dataset.id)"
          >
            Analytics
          </button>
          <button
            type="button"
            class="secondary-action"
            :disabled="datasetSwitchLoadingId === dataset.id"
            @click="$emit('export-workspace-dataset-summary', dataset.id)"
          >
            Export Summary
          </button>
          <button
            type="button"
            class="secondary-action"
            :disabled="datasetSwitchLoadingId === dataset.id"
            @click="$emit('clear-workspace-dataset-imported-studies', dataset.id)"
          >
            Clear Imports
          </button>
          <button
            type="button"
            class="secondary-action danger-action"
            :disabled="datasetSwitchLoadingId === dataset.id"
            @click="$emit('remove-workspace-dataset', dataset.id)"
          >
            Remove
          </button>
        </div>
      </article>
    </div>
    <div v-else class="workspace-dataset-empty">
      <strong>No saved datasets match this search.</strong>
      <p>Clear the search or upload another dataset to expand the local workspace list.</p>
    </div>
  </section>

  <section v-if="savedDatasetCount > 0" class="selection-card workspace-datasets-card">
    <div class="selection-card-header">
      <div>
        <h2>Dataset Selector</h2>
        <p>Choose the active dataset to browse without leaving the main Datasets page.</p>
      </div>
      <div class="selection-card-meta">
        <span>{{ savedDatasetCount }} dataset{{ savedDatasetCount === 1 ? '' : 's' }} saved</span>
        <span v-if="datasetListSearchInput.trim()">
          {{ datasetSelectorControls.totalResults }} match{{ datasetSelectorControls.totalResults === 1 ? '' : 'es' }}
        </span>
      </div>
    </div>

    <div class="workspace-dataset-toolbar">
      <label class="workspace-dataset-search">
        <span>Search datasets</span>
        <div class="workspace-dataset-search-input">
          <input
            :value="datasetListSearchInput"
            type="text"
            placeholder="Search by dataset label, folder name, path, or current location"
            @input="$emit('update:dataset-list-search-input', $event.target.value)"
          />
          <button
            v-if="datasetListSearchInput.trim()"
            type="button"
            class="workspace-dataset-search-clear"
            aria-label="Clear dataset search"
            @click="$emit('clear-dataset-list-search')"
          >
            Clear
          </button>
        </div>
      </label>
      <label class="workspace-dataset-sort">
        <span>Sort</span>
        <select :value="datasetListSortMode" @change="$emit('update:dataset-list-sort-mode', $event.target.value)">
          <option value="recent">Recently opened</option>
          <option value="label">Label</option>
          <option value="source">Source</option>
        </select>
      </label>
      <label class="workspace-dataset-sort">
        <span>Results</span>
        <select :value="datasetSelectorPageSize" @change="$emit('update:dataset-selector-page-size', $event.target.value)">
          <option :value="5">5</option>
          <option :value="10">10</option>
          <option :value="100">100</option>
        </select>
      </label>
    </div>

    <div v-if="workspaceDatasets.length > 0" class="table-view-card dataset-selector-table-card">
      <div class="table-view-header">
        <p>Use this table to switch the active dataset quickly.</p>
        <span class="file-list-note">Need management actions? Open Workspace Datasets from the sidebar.</span>
      </div>
      <div class="table-scroll">
        <table class="current-folder-table dataset-selector-table">
          <thead>
            <tr>
              <th>Dataset Number</th>
              <th>Dataset Name</th>
              <th>Total Files</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="dataset in workspaceDatasets"
              :key="dataset.id"
              :class="{ selected: dataset.id === activeDatasetId }"
            >
              <td>{{ dataset.label }}</td>
              <td>
                <div class="dataset-selector-name">
                  <strong>{{ dataset.sourceLabel || dataset.sourcePath || dataset.label }}</strong>
                  <small>{{ dataset.sourcePath || 'No saved source path' }}</small>
                </div>
              </td>
              <td>{{ dataset.summary?.selectedFiles || 0 }}</td>
              <td>
                <button
                  type="button"
                  class="table-action-button"
                  :disabled="datasetSwitchLoadingId === dataset.id"
                  @click="$emit('open-workspace-dataset', dataset.id)"
                >
                  {{
                    datasetSwitchLoadingId === dataset.id
                      ? 'Opening...'
                      : dataset.id === activeDatasetId
                        ? 'Open Active'
                        : 'Open'
                  }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-bar">
        <span class="pagination-copy">
          Page {{ datasetSelectorControls.page }} / {{ datasetSelectorControls.totalPages }}
        </span>
        <div class="pagination-actions">
          <button
            type="button"
            class="pagination-button"
            :disabled="datasetSelectorControls.page <= 1"
            @click="$emit('go-to-dataset-selector-page', 1)"
          >
            First
          </button>
          <button
            type="button"
            class="pagination-button"
            :disabled="datasetSelectorControls.page <= 1"
            @click="$emit('go-to-dataset-selector-page', datasetSelectorControls.page - 1)"
          >
            Previous
          </button>
          <form class="pagination-goto" @submit.prevent="$emit('submit-dataset-selector-page')">
            <label class="pagination-goto-label" for="dataset-selector-page-input">
              Go to page
            </label>
            <input
              id="dataset-selector-page-input"
              :value="datasetSelectorPageInput"
              class="pagination-input"
              inputmode="numeric"
              aria-describedby="dataset-selector-page-hint"
              @input="$emit('update:dataset-selector-page-input', $event.target.value)"
            />
            <button type="submit" class="pagination-button pagination-go-button">
              Go
            </button>
          </form>
          <button
            type="button"
            class="pagination-button"
            :disabled="datasetSelectorControls.page >= datasetSelectorControls.totalPages"
            @click="$emit('go-to-dataset-selector-page', datasetSelectorControls.page + 1)"
          >
            Next
          </button>
          <button
            type="button"
            class="pagination-button"
            :disabled="datasetSelectorControls.page >= datasetSelectorControls.totalPages"
            @click="$emit('go-to-dataset-selector-page', datasetSelectorControls.totalPages)"
          >
            Last
          </button>
        </div>
      </div>
      <p
        id="dataset-selector-page-hint"
        class="pagination-guidance"
        :class="{ error: Boolean(datasetSelectorPageError) }"
      >
        {{ datasetSelectorPageError || `Enter a page from 1 to ${datasetSelectorControls.totalPages}.` }}
      </p>
    </div>

    <div v-else class="workspace-dataset-empty">
      <strong>No saved datasets match this search.</strong>
      <p>Clear the search or upload another dataset to expand the selector list.</p>
    </div>
  </section>

  <template v-if="!summary">
    <section class="hero-card empty-workspace-card">
      <p class="eyebrow">Datasets</p>
      <h1>No dataset loaded</h1>
      <p class="intro">
        Upload a local folder first to unlock the datasets workspace and browse the analyzed DICOM structure.
      </p>
      <div class="dashboard-actions">
        <button type="button" class="primary" @click="$emit('navigate', 'upload')">
          Go to Upload
        </button>
        <button
          v-if="recentActiveSession"
          type="button"
          class="secondary-action"
          :disabled="resumeSessionLoading"
          @click="$emit('resume-recent-session')"
        >
          {{ resumeSessionLoading ? 'Resuming...' : 'Resume Recent Session' }}
        </button>
      </div>
    </section>
  </template>

  <section v-else class="analysis-card">
    <div v-if="recentUploadSuccess" class="upload-success-banner">
      <div>
        <span class="dashboard-card-label">Upload Complete</span>
        <h2>{{ recentUploadSuccess.datasetLabel || 'Your dataset' }} is ready in Datasets</h2>
        <p>
          <strong>{{ recentUploadSuccess.datasetLabel || 'The dataset' }}</strong>
          includes
          {{ recentUploadSuccess.dicomFiles }} DICOM file{{ recentUploadSuccess.dicomFiles === 1 ? '' : 's' }}
          across {{ recentUploadSuccess.folderCount }} folder{{ recentUploadSuccess.folderCount === 1 ? '' : 's' }}
          and was analyzed successfully. Start in Current Folder or jump to Dataset Hierarchy.
        </p>
      </div>
      <div class="upload-success-actions">
        <button
          type="button"
          class="secondary-action"
          @click="$emit('scroll-to-datasets-area', 'current-folder-section')"
        >
          Open Current Folder
        </button>
        <button
          type="button"
          class="secondary-action"
          @click="$emit('scroll-to-datasets-area', 'dataset-hierarchy-section')"
        >
          Open Hierarchy
        </button>
        <button
          type="button"
          class="secondary-action"
          @click="$emit('dismiss-upload-success')"
        >
          Dismiss
        </button>
      </div>
    </div>

    <div class="datasets-primary-column">
      <div class="datasets-focus-card">
        <div class="datasets-focus-copy">
          <span class="dashboard-card-label">Datasets Workspace</span>
          <h2>Browse the active local DICOM dataset</h2>
          <p>
            Use Current Folder for focused selection changes and Dataset Hierarchy for wider navigation across the recursive structure.
          </p>
        </div>
        <div class="stats datasets-stats">
          <div>
            <span class="stat-label">Selected files</span>
            <strong>{{ summary.totalFiles }}</strong>
          </div>
          <div>
            <span class="stat-label">DICOM files</span>
            <strong>{{ summary.dicomFiles }}</strong>
          </div>
          <div>
            <span class="stat-label">Folders</span>
            <strong>{{ summary.folderCount }}</strong>
          </div>
        </div>
        <div class="breadcrumbs">
          <button
            v-for="crumb in breadcrumbs"
            :key="crumb.path || 'root'"
            type="button"
            class="breadcrumb"
            @click="$emit('set-current-path', crumb.path)"
          >
            {{ crumb.label }}
          </button>
        </div>
        <div class="actions">
          <button
            type="button"
            class="primary"
            :disabled="analyzing || importing || currentNode.dicomCount === 0"
            @click="$emit('open-current-selection')"
          >
            {{
              analyzing
                ? 'Analyzing...'
                : importing
                  ? 'Importing...'
                  : `${viewerActionLabel} ${currentNode.dicomCount} DICOM file(s)`
            }}
          </button>
          <span class="selection-label">
            Current selection: <strong>{{ currentNode.label }}</strong>
          </span>
        </div>

        <div v-if="hasImportProgress" class="import-progress-card" :class="importProgressStatus">
          <div class="import-progress-copy">
            <span class="dashboard-card-label">Orthanc Import Progress</span>
            <strong>
              {{
                importProgressStatus === 'completed'
                  ? 'Import Complete'
                  : importProgressStatus === 'failed'
                    ? 'Import Failed'
                    : importProgressStatus === 'queued'
                      ? 'Preparing Import'
                      : 'Importing into Orthanc'
              }}
            </strong>
            <p>{{ importProgressLabel }}</p>
          </div>
          <div class="import-progress-meta">
            <span>
              {{ importProgressCompletedFiles }} / {{ importProgressTotalFiles || 0 }}
              {{ importProgressStatus === 'completed' ? 'imported' : 'completed' }}
            </span>
            <span v-if="importProgressFailedFiles > 0">
              {{ importProgressFailedFiles }} skipped
            </span>
          </div>
          <div
            class="import-progress-bar"
            role="progressbar"
            aria-label="Orthanc import progress"
            :aria-valuemin="0"
            :aria-valuemax="100"
            :aria-valuenow="importProgressPercent"
          >
            <span class="import-progress-bar-fill" :style="{ width: `${importProgressPercent}%` }" />
          </div>
          <div class="import-progress-footer">
            <span>{{ importProgressPercent }}%</span>
          </div>
        </div>
      </div>

      <div id="current-folder-section" class="selection-card">
        <div class="selection-card-header">
          <div>
            <h2>Current Folder</h2>
            <p>Open the selected folder in OHIF, or browse the recursive hierarchy below.</p>
          </div>
          <div class="selection-card-meta">
            <span>{{ currentFolderInfo.folderCount }} subfolder{{ currentFolderInfo.folderCount === 1 ? '' : 's' }}</span>
            <span>{{ currentFolderInfo.fileCount }} file{{ currentFolderInfo.fileCount === 1 ? '' : 's' }} here</span>
            <label class="view-mode-field">
              <span>View</span>
              <select :value="currentFolderViewMode" @change="$emit('update:current-folder-view-mode', $event.target.value)">
                <option value="default">Individual</option>
                <option value="table">Table</option>
                <option value="grouped">Grouped</option>
              </select>
            </label>
            <button
              v-if="hasCurrentFolderOverrides"
              type="button"
              class="reset-button"
              :disabled="currentFolderLoading"
              @click="$emit('reset-current-folder-controls')"
            >
              Reset
            </button>
          </div>
        </div>

        <div v-if="recentLocations.length > 0" class="recent-locations-card">
          <div class="recent-locations-header">
            <strong>Recent Locations</strong>
            <span>Jump back to folders you visited in this local session.</span>
          </div>
          <div class="recent-location-list">
            <button
              v-for="location in recentLocations"
              :key="location.path || 'root'"
              type="button"
              class="recent-location-button"
              :class="{ active: location.path === currentPath }"
              :disabled="currentFolderLoading"
              @click="$emit('jump-to-recent-location', location)"
            >
              {{ location.label }}
            </button>
          </div>
        </div>

        <div class="folder-toolbar">
          <label class="searchbox">
            <span class="search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2" />
                <path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
              </svg>
            </span>
            <input
              :ref="setFolderSearchInputRef"
              :value="folderSearchInput"
              type="text"
              placeholder="Search file or folder name"
              @input="$emit('update:folder-search-input', $event.target.value)"
            />
            <button
              v-if="folderSearchInput.trim()"
              type="button"
              class="clear-search"
              :disabled="currentFolderLoading"
              aria-label="Clear search"
              @click="$emit('clear-folder-search')"
            >
              <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-width="2"
                />
              </svg>
            </button>
          </label>

          <label class="toolbar-field">
            <span>Search scope</span>
            <select :value="currentFolderSearchScope" @change="$emit('update:current-folder-search-scope', $event.target.value)">
              <option value="descendants">Include descendants</option>
              <option value="current">Current folder only</option>
            </select>
          </label>

          <label class="toolbar-field">
            <span>Sort by</span>
            <select :value="currentFolderSortBy" @change="$emit('update:current-folder-sort-by', $event.target.value)">
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="dicomCount">DICOM count</option>
              <option value="type">Type</option>
            </select>
          </label>

          <label class="toolbar-field">
            <span>Direction</span>
            <select :value="currentFolderSortDir" @change="$emit('update:current-folder-sort-dir', $event.target.value)">
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>

          <label class="toolbar-field">
            <span>File type</span>
            <select :value="currentFolderExtensionFilter" @change="$emit('update:current-folder-extension-filter', $event.target.value)">
              <option value="all">All</option>
              <option value=".dcm">.dcm only</option>
              <option value="folders">Folders only</option>
            </select>
          </label>

          <label class="toolbar-field">
            <span>File size</span>
            <select :value="currentFolderSizeRange" @change="$emit('update:current-folder-size-range', $event.target.value)">
              <option value="all">All</option>
              <option value="lt1mb">Under 1 MB</option>
              <option value="1to10mb">1 MB to 10 MB</option>
              <option value="gt10mb">Over 10 MB</option>
            </select>
          </label>

          <label class="toolbar-field">
            <span>Results</span>
            <select :value="currentFolderPageSize" @change="$emit('update:current-folder-page-size', $event.target.value)">
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>

        <div class="folder-toolbar-summary">
          <span v-if="currentFolderLoading">Loading current folder results...</span>
          <span v-else>
            {{ currentFolderControls.totalResults }} result{{ currentFolderControls.totalResults === 1 ? '' : 's' }}
            on page {{ currentFolderControls.page }} of {{ currentFolderControls.totalPages }}
          </span>
        </div>

        <div v-if="activeFilterChips.length > 0" class="active-filters-card">
          <span class="active-filters-label">Active filters</span>
          <div class="active-filters-list">
            <button
              v-for="chip in activeFilterChips"
              :key="chip.key"
              type="button"
              class="active-filter-chip"
              :disabled="currentFolderLoading"
              @click="$emit('remove-filter-chip', chip.key)"
            >
              <span>{{ chip.label }}</span>
              <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-width="2"
                />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="selectedInspectorItem" :ref="setInspectorCardRef" class="inspector-card">
          <div class="inspector-header">
            <div>
              <span class="inspector-eyebrow">
                {{ selectedInspectorItem.type === 'folder' ? 'Selected Folder' : 'Selected File' }}
              </span>
              <h3>{{ selectedInspectorItem.displayName }}</h3>
            </div>
            <button
              type="button"
              class="inspector-dismiss"
              @click="$emit('clear-inspector-selection')"
            >
              Clear
            </button>
          </div>

          <div class="inspector-meta">
            <span>Path: {{ selectedInspectorItem.pathDisplay }}</span>
            <span v-if="selectedInspectorItem.type === 'folder'">
              {{ selectedInspectorItem.dicomCount }} DICOM{{ selectedInspectorItem.dicomCount === 1 ? '' : 's' }}
            </span>
            <span v-if="selectedInspectorItem.type === 'folder'">
              {{ selectedInspectorItem.folderCount }} subfolder{{ selectedInspectorItem.folderCount === 1 ? '' : 's' }}
            </span>
            <span v-if="selectedInspectorItem.type === 'file'">
              {{ formatFileSize(selectedInspectorItem.size) }}
            </span>
          </div>

          <div class="inspector-copy-row">
            <button
              type="button"
              class="copy-action"
              @click="$emit('copy-inspector-value', 'Path', selectedInspectorItem.pathDisplay)"
            >
              Copy Path
            </button>
            <button
              v-if="inspectorMetadataSummary?.studyInstanceUid"
              type="button"
              class="copy-action"
              @click="$emit('copy-inspector-value', 'StudyInstanceUID', inspectorMetadataSummary.studyInstanceUid)"
            >
              Copy Study UID
            </button>
            <button
              v-if="inspectorMetadataSummary?.seriesInstanceUid"
              type="button"
              class="copy-action"
              @click="$emit('copy-inspector-value', 'SeriesInstanceUID', inspectorMetadataSummary.seriesInstanceUid)"
            >
              Copy Series UID
            </button>
            <button
              v-if="inspectorMetadataSummary?.sopInstanceUid"
              type="button"
              class="copy-action"
              @click="$emit('copy-inspector-value', 'SOPInstanceUID', inspectorMetadataSummary.sopInstanceUid)"
            >
              Copy SOP UID
            </button>
          </div>

          <div class="inspector-details">
            <p v-if="inspectorMetadataLoading" class="inspector-loading">
              Loading DICOM metadata summary...
            </p>
            <p v-else-if="inspectorMetadataError" class="inspector-error">
              {{ inspectorMetadataError }}
            </p>
            <div
              v-else-if="inspectorMetadataSummary"
              class="inspector-details-grid"
            >
              <div class="inspector-detail">
                <span>Study</span>
                <strong>{{ summarizeMetadataValue(inspectorMetadataSummary.studyInstanceUid, inspectorMetadataSummary.studyCount, 'studies') }}</strong>
              </div>
              <div class="inspector-detail">
                <span>Series</span>
                <strong>{{ summarizeMetadataValue(inspectorMetadataSummary.seriesInstanceUid, inspectorMetadataSummary.seriesCount, 'series') }}</strong>
              </div>
              <div class="inspector-detail">
                <span>SOP</span>
                <strong>{{ summarizeMetadataValue(inspectorMetadataSummary.sopInstanceUid, inspectorMetadataSummary.sopCount, 'instances') }}</strong>
              </div>
              <div class="inspector-detail">
                <span>Modality</span>
                <strong>{{ summarizeMetadataValue(inspectorMetadataSummary.modality, inspectorMetadataSummary.modalityCount, 'modalities') }}</strong>
              </div>
              <div class="inspector-detail">
                <span>Instance Count</span>
                <strong>{{ inspectorMetadataSummary.instanceCount || 0 }}</strong>
              </div>
              <div class="inspector-detail">
                <span>File Size</span>
                <strong>{{ formatFileSize(inspectorMetadataSummary.totalSize || 0) }}</strong>
              </div>
            </div>
          </div>

          <div class="inspector-actions">
            <button
              v-if="selectedInspectorItem.type === 'folder'"
              type="button"
              class="secondary-action"
              :disabled="currentFolderLoading"
              @click="$emit('inspect-and-select-folder', selectedInspectorItem)"
            >
              View Folder
            </button>
            <button
              v-if="selectedInspectorItem.type === 'folder'"
              type="button"
              class="secondary-action"
              :disabled="exporting || selectedInspectorItem.dicomCount === 0"
              @click="$emit('download-inspector-selection')"
            >
              {{ exporting ? 'Preparing Download...' : 'Download Folder Files' }}
            </button>
            <button
              v-if="selectedInspectorItem.type === 'folder'"
              type="button"
              class="primary inspector-primary"
              :disabled="importing || exporting || selectedInspectorItem.dicomCount === 0"
              @click="$emit('open-inspector-selection')"
            >
              {{ viewerActionLabel }} Folder
            </button>
            <button
              v-if="selectedInspectorItem.type === 'file'"
              type="button"
              class="secondary-action"
              :disabled="currentFolderLoading"
              @click="$emit('go-to-inspector-parent-folder')"
            >
              Go to Parent Folder
            </button>
            <button
              v-if="selectedInspectorItem.type === 'file'"
              type="button"
              class="secondary-action"
              :disabled="exporting"
              @click="$emit('download-inspector-selection')"
            >
              {{ exporting ? 'Preparing Download...' : 'Download File' }}
            </button>
            <button
              v-if="selectedInspectorItem.type === 'file'"
              type="button"
              class="primary inspector-primary"
              :disabled="importing || exporting"
              @click="$emit('open-inspector-selection')"
            >
              {{ viewerActionLabel }} File
            </button>
          </div>
        </div>

        <div v-if="showGroupedFolderView" class="grouped-view-card">
          <div class="grouped-view-header">
            <div>
              <p>Grouped by Study and Series</p>
              <span>
                {{ currentFolderGroupedData.studyCount }} stud{{ currentFolderGroupedData.studyCount === 1 ? 'y' : 'ies' }}
                across {{ currentFolderGroupedData.directFileCount }} direct file{{ currentFolderGroupedData.directFileCount === 1 ? '' : 's' }}
              </span>
            </div>
          </div>

          <div v-if="currentFolderGroupedLoading" class="grouped-view-empty">
            Loading grouped Current Folder view...
          </div>
          <div v-else-if="currentFolderGroupedError" class="grouped-view-empty">
            {{ currentFolderGroupedError }}
          </div>
          <div
            v-else-if="currentFolderGroupedData.studyCount === 0"
            class="grouped-view-empty"
          >
            No direct DICOM files are available to group in this folder.
          </div>
          <div v-else class="study-group-list">
            <div
              v-for="study in currentFolderGroupedData.studies"
              :key="study.studyInstanceUid || `study-${study.instanceCount}`"
              class="study-group-card"
            >
              <div class="study-group-header">
                <div>
                  <span class="group-label">Study</span>
                  <strong>{{ study.studyInstanceUid || 'Unavailable' }}</strong>
                </div>
                <button
                  type="button"
                  class="secondary-action"
                  :disabled="importing"
                  @click="$emit('open-grouped-paths', study.series.flatMap((series) => series.files.map((file) => file.relativePath)))"
                >
                  Open Study
                </button>
              </div>
              <p class="group-meta">
                {{ study.seriesCount }} series, {{ study.instanceCount }} instances, {{ formatFileSize(study.totalSize) }}
              </p>
              <div class="series-group-list">
                <div
                  v-for="series in study.series"
                  :key="series.seriesInstanceUid || `series-${series.instanceCount}`"
                  class="series-group-card"
                >
                  <div class="series-group-header">
                    <div>
                      <span class="group-label">Series</span>
                      <strong>{{ series.seriesInstanceUid || 'Unavailable' }}</strong>
                    </div>
                    <button
                      type="button"
                      class="secondary-action"
                      :disabled="importing"
                      @click="$emit('open-grouped-paths', series.files.map((file) => file.relativePath))"
                    >
                      Open Series
                    </button>
                  </div>
                  <p class="group-meta">
                    {{ series.modality || 'Unknown modality' }},
                    {{ series.instanceCount }} instance{{ series.instanceCount === 1 ? '' : 's' }},
                    {{ formatFileSize(series.totalSize) }}
                  </p>

                  <div class="grouped-file-list">
                    <button
                      v-for="file in series.files"
                      :key="file.relativePath"
                      type="button"
                      class="file-button"
                      :disabled="importing"
                      @click="$emit('open-grouped-paths', [file.relativePath])"
                    >
                      {{ file.name }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="showTableFolderView" class="table-view-card">
          <div class="table-view-header">
            <p>Compact table view for the Current Folder</p>
          </div>

          <div v-if="currentFolderEntries.length > 0" class="table-scroll">
            <table class="current-folder-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Details</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in currentFolderEntries"
                  :key="entry.type === 'file' ? entry.relativePath : entry.path"
                  :class="{ selected: getInspectorItemKey(selectedInspectorItem) === getInspectorItemKey(entry) }"
                >
                  <td>{{ entry.type === 'file' ? 'DCM' : 'DIR' }}</td>
                  <td>
                    <button
                      type="button"
                      class="table-name-button"
                      :disabled="currentFolderLoading"
                      @click="$emit('select-inspector-item', entry)"
                    >
                      {{ entry.fileName || entry.label || entry.name }}
                    </button>
                  </td>
                  <td>{{ formatParentPath(entry.targetPath) }}</td>
                  <td>
                    <span v-if="entry.type === 'folder'">
                      {{ entry.dicomCount }} DICOM, {{ entry.folderCount }} subfolder{{ entry.folderCount === 1 ? '' : 's' }}
                    </span>
                    <span v-else>
                      {{ formatFileSize(entry.size || 0) }}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      class="table-action-button"
                      :disabled="currentFolderLoading"
                      @click="$emit('select-inspector-item', entry)"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state">
            No matching files or folders were found for this search.
          </div>
        </div>

        <div v-else class="node-grid">
          <div
            v-if="currentFolderControls.recursiveSearch"
            class="search-results-card"
          >
            <div class="file-list-header">
              <p>Recursive search results</p>
              <span class="file-list-note">
                Click a result path to move the selection and hierarchy to that location.
              </span>
            </div>
            <div v-if="currentFolderEntries.length > 0" class="search-result-list">
              <div
                v-for="entry in currentFolderEntries"
                :key="entry.type === 'file' ? entry.relativePath : entry.path"
                class="search-result-item"
                :class="{ selected: getInspectorItemKey(selectedInspectorItem) === getInspectorItemKey(entry) }"
              >
                <span class="search-result-type">{{ entry.type === 'file' ? 'DICOM' : 'Folder' }}</span>
                <div class="search-result-content">
                  <div class="search-result-breadcrumb-button">
                    <span class="search-result-breadcrumb">
                      <span
                        v-for="(crumb, index) in buildBreadcrumbButtons(entry)"
                        :key="`${crumb.label}-${index}`"
                        class="search-breadcrumb-part"
                      >
                        <button
                          type="button"
                          class="search-crumb-button"
                          @click="$emit('jump-to-breadcrumb-path', crumb.path)"
                        >
                          {{ crumb.label }}
                        </button>
                        <span v-if="index < entry.breadcrumbParts.length - 1" class="search-breadcrumb-sep">/</span>
                      </span>
                    </span>
                  </div>

                  <div class="search-result-meta">
                    <span v-if="entry.type === 'folder'">
                      {{ entry.dicomCount }} DICOM, {{ entry.folderCount }} subfolder{{ entry.folderCount === 1 ? '' : 's' }}
                    </span>
                    <span v-else>
                      {{ formatFileSize(entry.size || 0) }} in {{ formatParentPath(entry.targetPath) }}
                    </span>
                  </div>

                  <button
                    v-if="entry.type === 'file'"
                    type="button"
                    class="search-result-file-button"
                    :disabled="importing || currentFolderLoading"
                    @click="$emit('select-inspector-item', entry)"
                  >
                    Inspect {{ entry.fileName || entry.name }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <template v-else>
            <button
              v-for="node in currentFolderFolders"
              :key="node.path"
              type="button"
              class="node-card"
              :class="{ selected: getInspectorItemKey(selectedInspectorItem) === getInspectorItemKey(node) }"
              :disabled="currentFolderLoading"
              @click="$emit('select-inspector-item', node)"
            >
              <span class="node-type-badge">DIR</span>
              <span class="node-name">{{ node.name }}</span>
              <span class="node-meta">{{ node.dicomCount }} DICOM</span>
              <span class="node-submeta">
                {{ node.folderCount }} subfolder{{ node.folderCount === 1 ? '' : 's' }}
              </span>
            </button>

            <div v-if="currentFolderFiles.length > 0" class="file-list">
              <div class="file-list-header">
                <p>Files directly in this level</p>
                <span class="file-list-note">
                  Click a file here to open only that DICOM object in the viewer.
                </span>
              </div>
              <div class="file-button-list">
                <button
                  v-for="file in currentFolderFiles"
                  :key="file.relativePath"
                  type="button"
                  class="file-button"
                  :class="{ selected: getInspectorItemKey(selectedInspectorItem) === getInspectorItemKey(file) }"
                  :disabled="importing || currentFolderLoading"
                  @click="$emit('select-inspector-item', file)"
                >
                  <span class="file-type-badge">DCM</span>
                  <span class="file-copy">
                    <strong>{{ file.name }}</strong>
                    <small>{{ formatFileSize(file.size || 0) }} &middot; {{ formatParentPath(file.targetPath) }}</small>
                  </span>
                </button>
              </div>
            </div>
          </template>

          <div
            v-if="!currentFolderLoading && currentFolderEntries.length === 0"
            class="empty-state"
          >
            No matching files or folders were found for this search.
          </div>
        </div>

        <div class="pagination-bar">
          <span class="pagination-copy">
            Page {{ currentFolderControls.page }} / {{ currentFolderControls.totalPages }}
          </span>
          <div class="pagination-actions">
            <button
              type="button"
              class="pagination-button"
              :disabled="currentFolderControls.page <= 1 || currentFolderLoading"
              @click="$emit('go-to-current-folder-page', 1)"
            >
              First
            </button>
            <button
              type="button"
              class="pagination-button"
              :disabled="currentFolderControls.page <= 1 || currentFolderLoading"
              @click="$emit('go-to-current-folder-page', currentFolderControls.page - 1)"
            >
              Previous
            </button>
            <form class="pagination-goto" @submit.prevent="$emit('submit-current-folder-page')">
              <label class="pagination-goto-label" for="current-folder-page-input">
                Go to page
              </label>
              <input
                id="current-folder-page-input"
                :value="currentFolderPageInput"
                class="pagination-input"
                inputmode="numeric"
                :disabled="currentFolderLoading"
                aria-describedby="current-folder-page-hint"
                @input="$emit('update:current-folder-page-input', $event.target.value)"
              />
              <button
                type="submit"
                class="pagination-button pagination-go-button"
                :disabled="currentFolderLoading"
              >
                Go
              </button>
            </form>
            <button
              type="button"
              class="pagination-button"
              :disabled="currentFolderControls.page >= currentFolderControls.totalPages || currentFolderLoading"
              @click="$emit('go-to-current-folder-page', currentFolderControls.page + 1)"
            >
              Next
            </button>
            <button
              type="button"
              class="pagination-button"
              :disabled="currentFolderControls.page >= currentFolderControls.totalPages || currentFolderLoading"
              @click="$emit('go-to-current-folder-page', currentFolderControls.totalPages)"
            >
              Last
            </button>
          </div>
        </div>
        <p
          id="current-folder-page-hint"
          class="pagination-guidance"
          :class="{ error: Boolean(currentFolderPageError) }"
        >
          {{ currentFolderPageError || `Enter a page from 1 to ${currentFolderControls.totalPages}.` }}
        </p>
      </div>

      <div id="dataset-hierarchy-section" class="hierarchy-card">
        <div class="hierarchy-header">
          <div>
            <h2>Dataset Hierarchy</h2>
            <p>
              Click a folder name to expand it, inspect nested DICOM content, and change the
              current selection.
            </p>
          </div>
          <span class="hierarchy-note">Recursive DICOM-only structure</span>
        </div>

        <div class="hierarchy-tree">
          <HierarchyNode
            v-for="node in treeChildren"
            :key="node.path"
            :node="node"
            :expanded-paths="expandedPathsList"
            :selected-path="currentPath"
            @toggle-folder="$emit('toggle-folder', $event)"
            @toggle-overflow="(path, target) => $emit('toggle-overflow', path, target)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import HierarchyNode from '../components/HierarchyNode.vue';

defineProps([
  'summary',
  'workspaceDatasets',
  'savedDatasetCount',
  'datasetListSearchInput',
  'datasetListSortMode',
  'datasetSelectorControls',
  'datasetSelectorPageInput',
  'datasetSelectorPageError',
  'datasetSelectorPageSize',
  'activeDatasetId',
  'datasetSwitchLoadingId',
  'recentActiveSession',
  'resumeSessionLoading',
  'recentUploadSuccess',
  'breadcrumbs',
  'currentNode',
  'viewerActionLabel',
  'analyzing',
  'importing',
  'hasImportProgress',
  'importProgressStatus',
  'importProgressTotalFiles',
  'importProgressCompletedFiles',
  'importProgressFailedFiles',
  'importProgressPercent',
  'importProgressLabel',
  'currentFolderInfo',
  'currentFolderViewMode',
  'hasCurrentFolderOverrides',
  'currentFolderLoading',
  'recentLocations',
  'currentPath',
  'setFolderSearchInputRef',
  'folderSearchInput',
  'currentFolderSearchScope',
  'currentFolderSortBy',
  'currentFolderSortDir',
  'currentFolderExtensionFilter',
  'currentFolderSizeRange',
  'currentFolderPageSize',
  'currentFolderControls',
  'activeFilterChips',
  'selectedInspectorItem',
  'setInspectorCardRef',
  'inspectorMetadataSummary',
  'inspectorMetadataLoading',
  'inspectorMetadataError',
  'exporting',
  'formatFileSize',
  'summarizeMetadataValue',
  'showGroupedFolderView',
  'currentFolderGroupedData',
  'currentFolderGroupedLoading',
  'currentFolderGroupedError',
  'showTableFolderView',
  'currentFolderEntries',
  'getInspectorItemKey',
  'formatParentPath',
  'buildBreadcrumbButtons',
  'currentFolderFolders',
  'currentFolderFiles',
  'currentFolderPageInput',
  'currentFolderPageError',
  'treeChildren',
  'expandedPathsList',
]);

defineEmits([
  'navigate',
  'resume-recent-session',
  'open-workspace-dataset',
  'open-workspace-dataset-analytics',
  'export-workspace-dataset-summary',
  'clear-workspace-dataset-imported-studies',
  'remove-workspace-dataset',
  'update:dataset-list-search-input',
  'clear-dataset-list-search',
  'update:dataset-list-sort-mode',
  'update:dataset-selector-page-size',
  'update:dataset-selector-page-input',
  'go-to-dataset-selector-page',
  'submit-dataset-selector-page',
  'dismiss-upload-success',
  'scroll-to-datasets-area',
  'set-current-path',
  'open-current-selection',
  'update:current-folder-view-mode',
  'reset-current-folder-controls',
  'jump-to-recent-location',
  'update:folder-search-input',
  'clear-folder-search',
  'update:current-folder-search-scope',
  'update:current-folder-sort-by',
  'update:current-folder-sort-dir',
  'update:current-folder-extension-filter',
  'update:current-folder-size-range',
  'update:current-folder-page-size',
  'remove-filter-chip',
  'clear-inspector-selection',
  'copy-inspector-value',
  'inspect-and-select-folder',
  'download-inspector-selection',
  'open-inspector-selection',
  'go-to-inspector-parent-folder',
  'open-grouped-paths',
  'select-inspector-item',
  'jump-to-breadcrumb-path',
  'go-to-current-folder-page',
  'submit-current-folder-page',
  'update:current-folder-page-input',
  'toggle-folder',
  'toggle-overflow',
]);
</script>

<style scoped>
.import-progress-card {
  margin-top: 1rem;
  padding: 1rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(27, 39, 51, 0.12);
  background: #ffffff;
  display: grid;
  gap: 0.7rem;
}

.import-progress-card.running,
.import-progress-card.queued {
  border-color: rgba(145, 92, 27, 0.24);
}

.import-progress-card.completed {
  border-color: rgba(42, 110, 78, 0.28);
}

.import-progress-card.failed,
.import-progress-card.canceled {
  border-color: rgba(153, 54, 38, 0.28);
}

.import-progress-copy {
  display: grid;
  gap: 0.2rem;
}

.import-progress-copy strong {
  font-size: 1rem;
  color: #1b2733;
}

.import-progress-copy p {
  margin: 0;
  color: #4a5563;
  overflow-wrap: anywhere;
}

.import-progress-meta,
.import-progress-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  color: #5b6673;
}

.import-progress-bar {
  position: relative;
  height: 0.8rem;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(27, 39, 51, 0.1);
}

.import-progress-bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #fde68a 0%, #facc15 35%, #f97316 70%, #22c55e 100%);
  transition: width 180ms ease;
}

.import-progress-card.completed .import-progress-bar-fill {
  background: linear-gradient(90deg, #fde68a 0%, #facc15 35%, #f97316 70%, #22c55e 100%);
}

.import-progress-card.failed .import-progress-bar-fill,
.import-progress-card.canceled .import-progress-bar-fill {
  background: linear-gradient(90deg, #b24b3a, #de7b68);
}
</style>
