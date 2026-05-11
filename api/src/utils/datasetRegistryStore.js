const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const REGISTRY_FILE_PATH = process.env.DATASET_REGISTRY_FILE
  ? path.resolve(process.env.DATASET_REGISTRY_FILE)
  : '/opt/app/data/datasets-registry.json';
const DEFAULT_PAGE_SIZE = 10;
const ALLOWED_PAGE_SIZES = new Set([5, 10, 25, 50, 100]);
const ALLOWED_SORT_MODES = new Set(['recent', 'label', 'source', 'created']);
const LARGE_WORKSPACE_WARNING_THRESHOLD = Number(process.env.DATASET_REGISTRY_WARNING_COUNT) || 10;
const VERY_LARGE_WORKSPACE_WARNING_THRESHOLD = Number(process.env.DATASET_REGISTRY_ELEVATED_COUNT) || 25;

let writeQueue = Promise.resolve();

function buildEmptyRegistry() {
  return {
    version: 1,
    updatedAt: null,
    datasets: [],
  };
}

function normalizeSummary(summary = {}) {
  return {
    selectedFiles: Number(summary.selectedFiles) || 0,
    dicomFiles: Number(summary.dicomFiles) || 0,
    folderCount: Number(summary.folderCount) || 0,
    studyCount: Number(summary.studyCount) || 0,
    seriesCount: Number(summary.seriesCount) || 0,
    ignoredFileCount: Number(summary.ignoredFileCount) || 0,
  };
}

function normalizeStatus(status = {}) {
  return {
    sessionAvailable: Boolean(status.sessionAvailable),
    orthancImported: Boolean(status.orthancImported),
    staleSession: Boolean(status.staleSession),
    pendingDeletion: Boolean(status.pendingDeletion),
  };
}

function normalizeFileManifest(fileManifest) {
  return Array.isArray(fileManifest)
    ? fileManifest.map((entry) => ({
      path: String(entry?.path || '').replace(/\\/g, '/').replace(/^\/+/, ''),
      size: Number(entry?.size) || 0,
    })).filter((entry) => entry.path)
    : [];
}

function normalizeDatasetRecord(dataset = {}) {
  const now = new Date().toISOString();

  return {
    id: String(dataset.id || `dataset-${crypto.randomUUID().slice(0, 8)}`),
    label: String(dataset.label || '').trim() || 'Untitled Dataset',
    sourcePath: String(dataset.sourcePath || '').trim(),
    sourceLabel: String(dataset.sourceLabel || '').trim(),
    sourceType: String(dataset.sourceType || 'uploaded').trim() || 'uploaded',
    sessionId: dataset.sessionId ? String(dataset.sessionId) : null,
    status: normalizeStatus(dataset.status || {}),
    summary: normalizeSummary(dataset.summary || {}),
    currentPath: String(dataset.currentPath || '').trim(),
    createdAt: dataset.createdAt ? String(dataset.createdAt) : now,
    updatedAt: dataset.updatedAt ? String(dataset.updatedAt) : now,
    lastOpenedAt: dataset.lastOpenedAt ? String(dataset.lastOpenedAt) : now,
    lastSessionValidatedAt: dataset.lastSessionValidatedAt
      ? String(dataset.lastSessionValidatedAt)
      : null,
    fileManifest: normalizeFileManifest(dataset.fileManifest),
  };
}

function normalizeRegistryFile(rawValue) {
  const registry = rawValue && typeof rawValue === 'object' ? rawValue : buildEmptyRegistry();

  return {
    version: Number(registry.version) || 1,
    updatedAt: registry.updatedAt ? String(registry.updatedAt) : null,
    datasets: Array.isArray(registry.datasets)
      ? registry.datasets.map((dataset) => normalizeDatasetRecord(dataset))
      : [],
  };
}

async function ensureRegistryFileExists() {
  await fs.mkdir(path.dirname(REGISTRY_FILE_PATH), { recursive: true });

  try {
    await fs.access(REGISTRY_FILE_PATH);
  } catch (_error) {
    const emptyRegistry = buildEmptyRegistry();
    await fs.writeFile(REGISTRY_FILE_PATH, JSON.stringify(emptyRegistry, null, 2));
  }
}

async function readDatasetRegistry() {
  await ensureRegistryFileExists();
  const rawText = await fs.readFile(REGISTRY_FILE_PATH, 'utf8');
  const parsedValue = JSON.parse(rawText);
  return normalizeRegistryFile(parsedValue);
}

async function writeDatasetRegistry(nextRegistry) {
  const normalizedRegistry = normalizeRegistryFile({
    ...nextRegistry,
    updatedAt: new Date().toISOString(),
  });

  writeQueue = writeQueue.then(async () => {
    await ensureRegistryFileExists();
    await fs.writeFile(REGISTRY_FILE_PATH, JSON.stringify(normalizedRegistry, null, 2));
  });

  await writeQueue;
  return normalizedRegistry;
}

function buildPagedResult(registry, options = {}) {
  const search = String(options.search || '').trim().toLowerCase();
  const status = String(options.status || 'all');
  const sort = ALLOWED_SORT_MODES.has(String(options.sort || ''))
    ? String(options.sort)
    : 'recent';
  const pageSizeCandidate = Number(options.pageSize) || DEFAULT_PAGE_SIZE;
  const pageSize = ALLOWED_PAGE_SIZES.has(pageSizeCandidate) ? pageSizeCandidate : DEFAULT_PAGE_SIZE;
  const pageCandidate = Number(options.page) || 1;

  const filteredDatasets = registry.datasets.filter((dataset) => {
    const matchesStatus = status === 'available'
      ? dataset.status?.sessionAvailable !== false
      : status === 'stale'
        ? dataset.status?.staleSession === true
        : true;

    if (!matchesStatus) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [
      dataset.id,
      dataset.label,
      dataset.sourcePath,
      dataset.sourceLabel,
      dataset.currentPath,
      dataset.sessionId,
    ].some((value) => String(value || '').toLowerCase().includes(search));
  });

  const sortedDatasets = [...filteredDatasets].sort((left, right) => {
    if (sort === 'label') {
      return left.label.localeCompare(right.label);
    }

    if (sort === 'source') {
      return String(left.sourceLabel || left.sourcePath || '').localeCompare(
        String(right.sourceLabel || right.sourcePath || ''),
      );
    }

    if (sort === 'created') {
      return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
    }

    return String(right.lastOpenedAt || right.updatedAt || right.createdAt || '').localeCompare(
      String(left.lastOpenedAt || left.updatedAt || left.createdAt || ''),
    );
  });

  const totalResults = sortedDatasets.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const page = Math.min(Math.max(pageCandidate, 1), totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    items: sortedDatasets.slice(startIndex, startIndex + pageSize),
    controls: {
      page,
      pageSize,
      totalResults,
      totalPages,
      search: String(options.search || ''),
      sort,
      status,
    },
  };
}

async function listDatasetRegistry(options = {}) {
  const registry = await readDatasetRegistry();
  const paged = buildPagedResult(registry, options);

  return {
    version: registry.version,
    updatedAt: registry.updatedAt,
    ...paged,
  };
}

function buildWorkspaceGuardrailSummary(registry) {
  const totalDatasets = registry.datasets.length;
  const availableDatasets = registry.datasets.filter((dataset) => dataset.status?.sessionAvailable !== false).length;
  const staleDatasets = registry.datasets.filter((dataset) => dataset.status?.staleSession === true).length;

  let level = 'normal';
  let message = 'The local workspace is within the normal saved-dataset range.';

  if (totalDatasets >= VERY_LARGE_WORKSPACE_WARNING_THRESHOLD) {
    level = 'elevated';
    message = 'This workspace already has many saved datasets. Search and paging stay backend-backed, but new uploads should be more intentional.';
  } else if (totalDatasets >= LARGE_WORKSPACE_WARNING_THRESHOLD) {
    level = 'warning';
    message = 'This workspace is getting large. Use search, paging, and saved-dataset review to keep uploads manageable.';
  }

  return {
    totalDatasets,
    availableDatasets,
    staleDatasets,
    warningThreshold: LARGE_WORKSPACE_WARNING_THRESHOLD,
    elevatedThreshold: VERY_LARGE_WORKSPACE_WARNING_THRESHOLD,
    level,
    message,
  };
}

async function getDatasetRegistryWorkspaceSummary() {
  const registry = await readDatasetRegistry();

  return {
    version: registry.version,
    updatedAt: registry.updatedAt,
    workspace: buildWorkspaceGuardrailSummary(registry),
  };
}

async function getDatasetById(datasetId) {
  const registry = await readDatasetRegistry();
  return registry.datasets.find((dataset) => dataset.id === datasetId) || null;
}

async function createDatasetRecord(input = {}) {
  const registry = await readDatasetRegistry();
  const nextDataset = normalizeDatasetRecord(input);

  if (registry.datasets.some((dataset) => dataset.id === nextDataset.id)) {
    throw new Error(`Dataset id ${nextDataset.id} already exists`);
  }

  const nextRegistry = await writeDatasetRegistry({
    ...registry,
    datasets: [...registry.datasets, nextDataset],
  });

  return nextRegistry.datasets.find((dataset) => dataset.id === nextDataset.id) || nextDataset;
}

async function updateDatasetRecord(datasetId, updates = {}) {
  const registry = await readDatasetRegistry();
  const existingDataset = registry.datasets.find((dataset) => dataset.id === datasetId);

  if (!existingDataset) {
    return null;
  }

  const nextDataset = normalizeDatasetRecord({
    ...existingDataset,
    ...updates,
    id: existingDataset.id,
    createdAt: existingDataset.createdAt,
    updatedAt: new Date().toISOString(),
  });

  const nextRegistry = await writeDatasetRegistry({
    ...registry,
    datasets: registry.datasets.map((dataset) => (
      dataset.id === datasetId ? nextDataset : dataset
    )),
  });

  return nextRegistry.datasets.find((dataset) => dataset.id === datasetId) || nextDataset;
}

async function deleteDatasetRecord(datasetId) {
  const registry = await readDatasetRegistry();
  const existingDataset = registry.datasets.find((dataset) => dataset.id === datasetId);

  if (!existingDataset) {
    return null;
  }

  await writeDatasetRegistry({
    ...registry,
    datasets: registry.datasets.filter((dataset) => dataset.id !== datasetId),
  });

  return existingDataset;
}

async function reconcileDatasetSessionStatuses(hasSession, options = {}) {
  const registry = await readDatasetRegistry();
  const targetDatasetId = options.datasetId ? String(options.datasetId) : '';
  const now = new Date().toISOString();
  let didChange = false;

  const nextDatasets = registry.datasets.map((dataset) => {
    if (targetDatasetId && dataset.id !== targetDatasetId) {
      return dataset;
    }

    if (!dataset.sessionId) {
      const nextDataset = normalizeDatasetRecord({
        ...dataset,
        status: {
          ...dataset.status,
          sessionAvailable: false,
          staleSession: true,
        },
        lastSessionValidatedAt: now,
      });
      didChange = didChange || JSON.stringify(nextDataset) !== JSON.stringify(dataset);
      return nextDataset;
    }

    const available = Boolean(hasSession(dataset.sessionId));
    const nextDataset = normalizeDatasetRecord({
      ...dataset,
      status: {
        ...dataset.status,
        sessionAvailable: available,
        staleSession: !available,
      },
      lastSessionValidatedAt: now,
    });
    didChange = didChange || JSON.stringify(nextDataset) !== JSON.stringify(dataset);
    return nextDataset;
  });

  if (!didChange) {
    return registry;
  }

  return writeDatasetRegistry({
    ...registry,
    datasets: nextDatasets,
  });
}

module.exports = {
  REGISTRY_FILE_PATH,
  readDatasetRegistry,
  writeDatasetRegistry,
  listDatasetRegistry,
  getDatasetRegistryWorkspaceSummary,
  getDatasetById,
  createDatasetRecord,
  updateDatasetRecord,
  deleteDatasetRecord,
  reconcileDatasetSessionStatuses,
};
