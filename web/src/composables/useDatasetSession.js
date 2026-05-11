import { computed, ref } from 'vue';

const ACTIVE_DATASET_ID_STORAGE_KEY = 'dicom-local-viewer:active-dataset-id';
const LEGACY_DATASET_REGISTRY_STORAGE_KEY = 'dicom-local-viewer:dataset-registry';

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function buildDatasetLabel(existingDatasets) {
  const nextIndex = existingDatasets.reduce((highestIndex, dataset) => {
    const match = String(dataset?.label || '').match(/^Dataset (\d+)$/);
    if (!match) {
      return highestIndex;
    }

    return Math.max(highestIndex, Number(match[1]));
  }, 0) + 1;

  return `Dataset ${nextIndex}`;
}

function normalizeSummary(summary, ignoredFiles) {
  return {
    selectedFiles: summary?.totalFiles ?? summary?.selectedFiles ?? 0,
    dicomFiles: summary?.dicomFiles || 0,
    folderCount: summary?.folderCount || 0,
    studyCount: summary?.studyCount || 0,
    seriesCount: summary?.seriesCount || 0,
    ignoredFileCount: ignoredFiles?.ignoredFileCount ?? summary?.ignoredFileCount ?? 0,
  };
}

function normalizeFileManifest(fileManifest) {
  return Array.isArray(fileManifest)
    ? fileManifest.map((entry) => ({
      path: String(entry?.path || '').replace(/\\/g, '/').replace(/^\/+/, ''),
      size: Number(entry?.size || 0),
    })).filter((entry) => entry.path)
    : [];
}

async function readErrorMessage(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return payload?.error || fallbackMessage;
  } catch (_error) {
    return fallbackMessage;
  }
}

async function requestDatasetRegistry(path = '', options = {}) {
  const response = await fetch(`/api/dataset-registry${path}`, options);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Dataset registry request failed.'));
  }

  return response.status === 204 ? null : response.json();
}

async function reconcileDatasetRegistrySessions(datasetId = '') {
  return requestDatasetRegistry('/reconcile-sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(datasetId ? { datasetId } : {}),
  });
}

export function useDatasetSession() {
  const datasetRegistry = ref([]);
  const activeDatasetId = ref(canUseBrowserStorage()
    ? (window.localStorage.getItem(ACTIVE_DATASET_ID_STORAGE_KEY) || '')
    : '');

  clearLegacyBrowserDatasetRegistry();

  const activeDataset = computed(() => (
    datasetRegistry.value.find((dataset) => dataset.id === activeDatasetId.value) || null
  ));

  function persistActiveDatasetId() {
    if (!canUseBrowserStorage()) {
      return;
    }

    if (activeDatasetId.value) {
      window.localStorage.setItem(ACTIVE_DATASET_ID_STORAGE_KEY, activeDatasetId.value);
      return;
    }

    window.localStorage.removeItem(ACTIVE_DATASET_ID_STORAGE_KEY);
  }

  function clearLegacyBrowserDatasetRegistry() {
    if (!canUseBrowserStorage()) {
      return;
    }

    window.localStorage.removeItem(LEGACY_DATASET_REGISTRY_STORAGE_KEY);
  }

  async function loadDatasetRegistry() {
    clearLegacyBrowserDatasetRegistry();
    await reconcileDatasetRegistrySessions();

    let page = 1;
    let totalPages = 1;
    const datasets = [];

    while (page <= totalPages) {
      const payload = await requestDatasetRegistry(
        `?${new URLSearchParams({
          page: String(page),
          pageSize: '100',
          sort: 'recent',
        }).toString()}`,
      );

      datasets.push(...(payload.items || []));
      totalPages = payload.controls?.totalPages || 1;
      page += 1;
    }

    datasetRegistry.value = datasets;

    const currentActiveDataset = activeDatasetId.value
      ? datasetRegistry.value.find((dataset) => dataset.id === activeDatasetId.value) || null
      : null;

    if (
      activeDatasetId.value
      && (
        !currentActiveDataset
        || currentActiveDataset.status?.sessionAvailable === false
      )
    ) {
      activeDatasetId.value = '';
      persistActiveDatasetId();
    }

    return datasetRegistry.value;
  }

  async function loadDatasetRegistryPage(options = {}) {
    clearLegacyBrowserDatasetRegistry();
    await reconcileDatasetRegistrySessions();

    return requestDatasetRegistry(
      `?${new URLSearchParams({
        page: String(options.page || 1),
        pageSize: String(options.pageSize || 10),
        sort: String(options.sort || 'recent'),
        status: String(options.status || 'all'),
        search: String(options.search || ''),
      }).toString()}`,
    );
  }

  async function loadDatasetRegistryWorkspaceSummary() {
    clearLegacyBrowserDatasetRegistry();
    await reconcileDatasetRegistrySessions();
    return requestDatasetRegistry('/summary');
  }

  function findDatasetBySessionId(sessionId) {
    if (!sessionId) {
      return null;
    }

    return datasetRegistry.value.find((dataset) => dataset.sessionId === sessionId) || null;
  }

  function findDatasetById(datasetId) {
    if (!datasetId) {
      return null;
    }

    return datasetRegistry.value.find((dataset) => dataset.id === datasetId) || null;
  }

  async function upsertDataset({
    sessionId,
    label = '',
    sourcePath = '',
    sourceLabel = '',
    sourceType = '',
    summary = null,
    ignoredFiles = null,
    currentPath = '',
    fileManifest = null,
    openedAt,
  }) {
    if (!sessionId) {
      return null;
    }

    const now = openedAt || new Date().toISOString();
    const existingDataset = findDatasetBySessionId(sessionId);
    const payload = {
      label: label || existingDataset?.label || buildDatasetLabel(datasetRegistry.value),
      sessionId,
      sourcePath: sourcePath || existingDataset?.sourcePath || '',
      sourceLabel: sourceLabel || existingDataset?.sourceLabel || '',
      sourceType: sourceType || existingDataset?.sourceType || 'uploaded',
      currentPath: currentPath || existingDataset?.currentPath || '',
      lastOpenedAt: now,
      summary: normalizeSummary(summary, ignoredFiles),
      status: {
        sessionAvailable: true,
        orthancImported: existingDataset?.status?.orthancImported || false,
        staleSession: false,
        pendingDeletion: false,
      },
      fileManifest: normalizeFileManifest(fileManifest || existingDataset?.fileManifest),
    };

    const datasetRecord = existingDataset
      ? await requestDatasetRegistry(`/${existingDataset.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      : await requestDatasetRegistry('', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          createdAt: now,
          updatedAt: now,
          lastSessionValidatedAt: now,
        }),
      });

    await loadDatasetRegistry();
    activeDatasetId.value = datasetRecord.id;
    persistActiveDatasetId();
    return datasetRecord;
  }

  async function updateActiveDataset(fields = {}) {
    if (!activeDataset.value) {
      return null;
    }

    const nextDataset = await requestDatasetRegistry(`/${activeDataset.value.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...fields,
        status: fields.status
          ? {
            ...activeDataset.value.status,
            ...fields.status,
          }
          : undefined,
      }),
    });

    await loadDatasetRegistry();
    return nextDataset;
  }

  function clearActiveDataset() {
    activeDatasetId.value = '';
    persistActiveDatasetId();
  }

  function setActiveDatasetById(datasetId) {
    activeDatasetId.value = datasetId || '';
    persistActiveDatasetId();
  }

  async function removeDatasetBySessionId(sessionId) {
    const dataset = findDatasetBySessionId(sessionId);
    if (!dataset) {
      return null;
    }

    const removedDataset = await requestDatasetRegistry(`/${dataset.id}`, {
      method: 'DELETE',
    });
    await loadDatasetRegistry();

    if (activeDatasetId.value === dataset.id) {
      activeDatasetId.value = '';
      persistActiveDatasetId();
    }

    return removedDataset;
  }

  async function removeDatasetById(datasetId) {
    if (!datasetId) {
      return null;
    }

    const removedDataset = await requestDatasetRegistry(`/${datasetId}`, {
      method: 'DELETE',
    });
    await loadDatasetRegistry();

    if (activeDatasetId.value === datasetId) {
      activeDatasetId.value = '';
      persistActiveDatasetId();
    }

    return removedDataset;
  }

  return {
    datasetRegistry,
    activeDatasetId,
    activeDataset,
    loadDatasetRegistry,
    loadDatasetRegistryPage,
    loadDatasetRegistryWorkspaceSummary,
    reconcileDatasetRegistrySessions,
    findDatasetById,
    findDatasetBySessionId,
    upsertDataset,
    updateActiveDataset,
    clearActiveDataset,
    setActiveDatasetById,
    removeDatasetBySessionId,
    removeDatasetById,
    clearLegacyBrowserDatasetRegistry,
  };
}
