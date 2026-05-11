<template>
  <section class="hero-card">
    <p class="eyebrow">Workspace Datasets</p>
    <h1>Manage saved datasets</h1>
    <p class="intro">
      Search, sort, and manage saved datasets in one focused table that scales better as the workspace grows.
    </p>

    <section v-if="savedDatasetCount > 0" class="selection-card workspace-datasets-card">
      <div class="selection-card-header">
        <div>
          <h2>Saved Dataset Workspace</h2>
          <p>Use this page when you want to switch datasets or run dataset-level actions without crowding the main viewer.</p>
        </div>
        <div class="selection-card-meta">
          <span>{{ savedDatasetCount }} dataset{{ savedDatasetCount === 1 ? '' : 's' }} saved</span>
          <span v-if="datasetListSearchInput.trim()">
            {{ workspaceDatasetControls.totalResults }} match{{ workspaceDatasetControls.totalResults === 1 ? '' : 'es' }}
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
          <select :value="workspaceDatasetPageSize" @change="$emit('update:workspace-dataset-page-size', $event.target.value)">
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="100">100</option>
          </select>
        </label>
      </div>

      <div v-if="workspaceDatasets.length > 0" class="table-view-card dataset-selector-table-card">
        <div class="table-view-header">
          <p>Manage datasets from a single paginated table with searchable operational status columns.</p>
          <span class="file-list-note">Saved stale datasets stay visible here for review, but only datasets with a live session can be reopened directly.</span>
        </div>
        <div class="table-scroll">
          <table class="current-folder-table workspace-dataset-table">
            <thead>
              <tr>
                <th>Dataset Number</th>
                <th>Dataset Name</th>
                <th>Total Files</th>
                <th>Session Status</th>
                <th>Signals</th>
                <th>Current Location</th>
                <th>Last Opened</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="dataset in workspaceDatasets" :key="dataset.id">
                <tr :class="{ selected: dataset.id === activeDatasetId }">
                  <td>{{ dataset.label }}</td>
                  <td>
                    <div class="dataset-selector-name">
                      <button
                        type="button"
                        class="workspace-dataset-detail-link"
                        @click="$emit('open-dataset-detail', dataset.id)"
                      >
                        <strong>{{ dataset.sourceLabel || dataset.sourcePath || dataset.label }}</strong>
                      </button>
                      <small>{{ dataset.sourcePath || 'No saved source path' }}</small>
                    </div>
                  </td>
                  <td>{{ dataset.summary?.selectedFiles || 0 }}</td>
                  <td class="workspace-dataset-status-cell">
                    <div class="workspace-dataset-status-list">
                      <span
                        v-if="dataset.id === activeDatasetId"
                        class="workspace-dataset-badge active"
                      >
                        Active
                      </span>
                      <span
                        v-if="dataset.status?.sessionAvailable !== false"
                        class="workspace-dataset-badge live"
                      >
                        Live Session
                      </span>
                      <span
                        v-else
                        class="workspace-dataset-badge stale"
                      >
                        Stale Session
                      </span>
                    </div>
                  </td>
                  <td class="workspace-dataset-signals-cell">
                    <div class="workspace-dataset-signal-list">
                      <span
                        v-if="dataset.status?.orthancImported"
                        class="workspace-dataset-badge imported"
                      >
                        Imported
                      </span>
                      <span
                        v-if="hasIgnoredFiles(dataset)"
                        class="workspace-dataset-badge ignored"
                      >
                        Ignored Files
                      </span>
                      <span
                        v-if="isRecentDataset(dataset)"
                        class="workspace-dataset-badge recent"
                      >
                        Recent
                      </span>
                      <span
                        v-if="!dataset.status?.orthancImported && !hasIgnoredFiles(dataset) && !isRecentDataset(dataset)"
                        class="workspace-dataset-badge"
                      >
                        No Extra Signals
                      </span>
                    </div>
                  </td>
                  <td>{{ dataset.currentPath || 'Root' }}</td>
                  <td>{{ formatIsoTimestamp(dataset.lastOpenedAt || dataset.updatedAt || dataset.createdAt) }}</td>
                  <td class="workspace-dataset-actions-cell">
                    <button
                      type="button"
                      class="table-action-button workspace-dataset-expand-button"
                      :aria-expanded="String(expandedWorkspaceDatasetId === dataset.id)"
                      @click="toggleDatasetMenu(dataset.id)"
                    >
                      {{ expandedWorkspaceDatasetId === dataset.id ? 'Close Menu' : 'Actions' }}
                    </button>
                  </td>
                </tr>
                <tr
                  v-if="expandedWorkspaceDatasetId === dataset.id"
                  class="workspace-dataset-action-row"
                >
                  <td colspan="8">
                    <Transition name="workspace-dataset-menu" appear>
                      <div class="workspace-dataset-action-menu">
                        <button
                          type="button"
                          class="workspace-dataset-menu-item"
                          :disabled="datasetSwitchLoadingId === dataset.id"
                          @click="runMenuAction('open-dataset-detail', dataset.id)"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          class="workspace-dataset-menu-item"
                          :disabled="datasetSwitchLoadingId === dataset.id || dataset.status?.sessionAvailable === false"
                          @click="runMenuAction('open-workspace-dataset', dataset.id)"
                        >
                          {{ dataset.status?.sessionAvailable === false ? 'Session Unavailable' : dataset.id === activeDatasetId ? 'Open Active Dataset' : 'Open Dataset' }}
                        </button>
                        <button
                          type="button"
                          class="workspace-dataset-menu-item"
                          :disabled="datasetSwitchLoadingId === dataset.id || dataset.status?.sessionAvailable === false"
                          @click="runMenuAction('open-workspace-dataset-analytics', dataset.id)"
                        >
                          Analytics
                        </button>
                        <button
                          type="button"
                          class="workspace-dataset-menu-item"
                          :disabled="datasetSwitchLoadingId === dataset.id || dataset.status?.sessionAvailable === false"
                          @click="runMenuAction('export-workspace-dataset-summary', dataset.id)"
                        >
                          Export Summary
                        </button>
                        <button
                          type="button"
                          class="workspace-dataset-menu-item"
                          :disabled="datasetSwitchLoadingId === dataset.id || dataset.status?.sessionAvailable === false"
                          @click="runMenuAction('clear-workspace-dataset-imported-studies', dataset.id)"
                        >
                          Clear Imports
                        </button>
                        <button
                          type="button"
                          class="workspace-dataset-menu-item danger"
                          :disabled="datasetSwitchLoadingId === dataset.id"
                          @click="runMenuAction('remove-workspace-dataset', dataset.id)"
                        >
                          Remove Saved Dataset
                        </button>
                        <button
                          type="button"
                          class="workspace-dataset-menu-item danger"
                          :disabled="datasetSwitchLoadingId === dataset.id"
                          @click="runMenuAction('remove-workspace-dataset-everywhere', dataset.id)"
                        >
                          Remove Dataset Everywhere
                        </button>
                      </div>
                    </Transition>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="pagination-bar">
          <span class="pagination-copy">
            Page {{ workspaceDatasetControls.page }} / {{ workspaceDatasetControls.totalPages }}
          </span>
          <div class="pagination-actions">
            <button
              type="button"
              class="pagination-button"
              :disabled="workspaceDatasetControls.page <= 1"
              @click="$emit('go-to-workspace-dataset-page', 1)"
            >
              First
            </button>
            <button
              type="button"
              class="pagination-button"
              :disabled="workspaceDatasetControls.page <= 1"
              @click="$emit('go-to-workspace-dataset-page', workspaceDatasetControls.page - 1)"
            >
              Previous
            </button>
            <form class="pagination-goto" @submit.prevent="$emit('submit-workspace-dataset-page')">
              <label class="pagination-goto-label" for="workspace-dataset-page-input">
                Go to page
              </label>
              <input
                id="workspace-dataset-page-input"
                :value="workspaceDatasetPageInput"
                class="pagination-input"
                inputmode="numeric"
                aria-describedby="workspace-dataset-page-hint"
                @input="$emit('update:workspace-dataset-page-input', $event.target.value)"
              />
              <button type="submit" class="pagination-button pagination-go-button">
                Go
              </button>
            </form>
            <button
              type="button"
              class="pagination-button"
              :disabled="workspaceDatasetControls.page >= workspaceDatasetControls.totalPages"
              @click="$emit('go-to-workspace-dataset-page', workspaceDatasetControls.page + 1)"
            >
              Next
            </button>
            <button
              type="button"
              class="pagination-button"
              :disabled="workspaceDatasetControls.page >= workspaceDatasetControls.totalPages"
              @click="$emit('go-to-workspace-dataset-page', workspaceDatasetControls.totalPages)"
            >
              Last
            </button>
          </div>
        </div>
        <p
          id="workspace-dataset-page-hint"
          class="pagination-guidance"
          :class="{ error: Boolean(workspaceDatasetPageError) }"
        >
          {{ workspaceDatasetPageError || `Enter a page from 1 to ${workspaceDatasetControls.totalPages}.` }}
        </p>
      </div>

      <div v-else class="workspace-dataset-empty">
        <strong>No saved datasets match this search.</strong>
        <p>Clear the search or upload another dataset to expand the local workspace list.</p>
      </div>
    </section>

    <section v-else class="selection-card empty-workspace-card">
      <div class="selection-card-header">
        <div>
          <h2>No saved datasets yet</h2>
          <p>Analyze a local folder first to create datasets you can manage here later.</p>
        </div>
      </div>
      <div class="dashboard-actions">
        <button type="button" class="primary" @click="$emit('navigate', 'upload')">
          Go to Upload
        </button>
      </div>
    </section>
  </section>
</template>

<script setup>
function toggleDatasetMenu(datasetId) {
  emit('toggle-workspace-dataset-expansion', datasetId);
}

function runMenuAction(actionName, datasetId) {
  emit(actionName, datasetId);
  emit('toggle-workspace-dataset-expansion', datasetId);
}

function hasIgnoredFiles(dataset) {
  return Number(dataset?.summary?.ignoredFileCount || 0) > 0;
}

function isRecentDataset(dataset) {
  const reference = dataset?.lastOpenedAt || dataset?.updatedAt || dataset?.createdAt;
  if (!reference) {
    return false;
  }

  const timestamp = new Date(reference).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return (Date.now() - timestamp) <= 1000 * 60 * 60 * 24;
}

defineProps([
  'workspaceDatasets',
  'savedDatasetCount',
  'datasetListSearchInput',
  'datasetListSortMode',
  'workspaceDatasetControls',
  'workspaceDatasetPageInput',
  'workspaceDatasetPageError',
  'workspaceDatasetPageSize',
  'expandedWorkspaceDatasetId',
  'activeDatasetId',
  'datasetSwitchLoadingId',
  'formatIsoTimestamp',
]);

const emit = defineEmits([
  'navigate',
  'open-dataset-detail',
  'open-workspace-dataset',
  'open-workspace-dataset-analytics',
  'export-workspace-dataset-summary',
  'clear-workspace-dataset-imported-studies',
  'remove-workspace-dataset',
  'remove-workspace-dataset-everywhere',
  'update:dataset-list-search-input',
  'clear-dataset-list-search',
  'update:dataset-list-sort-mode',
  'update:workspace-dataset-page-size',
  'update:workspace-dataset-page-input',
  'go-to-workspace-dataset-page',
  'submit-workspace-dataset-page',
  'toggle-workspace-dataset-expansion',
]);
</script>
