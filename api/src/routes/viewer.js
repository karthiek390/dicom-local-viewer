const express = require('express');
const createError = require('http-errors');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const dicomParser = require('dicom-parser');

const orthanc = require('../services/orthanc');
const asyncHandler = require('../middleware/asyncHandler');
const { accessControl } = require('../middleware/auth');
const { getSourceRootMappings } = require('../config/sourceRoots');
const { mapHostPathToContainer } = require('../utils/pathMapping');
const { scanSourceDirectory } = require('../utils/sourceScanner');
const { resolveSessionFilePath } = require('../utils/sessionFileAccess');
const {
  setAnalysisSession,
  getAnalysisSession,
  hasAnalysisSession,
  deleteAnalysisSession,
} = require('../utils/analysisSessionStore');
const {
  createImportJob,
  getImportJob,
  startImportJob,
  setImportJobProgress,
  completeImportJob,
  failImportJob,
} = require('../utils/importProgressStore');

const router = express.Router();
const uploadRoot = process.env.UPLOAD_ROOT || '/opt/app/data/uploads';

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      if (!req.uploadDirectory) {
        req.uploadDirectory = path.join(uploadRoot, crypto.randomUUID());
        await fs.mkdir(req.uploadDirectory, { recursive: true });
      }
      cb(null, req.uploadDirectory);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024,
    files: 10000,
  },
});

function createNode(name, nodePath) {
  return {
    name,
    label: name || 'Root',
    path: nodePath,
    files: [],
    children: [],
    dicomCount: 0,
    folderCount: 0,
    showAllFolders: false,
    showAllFiles: false,
  };
}

function shouldIgnoreUploadPath(relativePath) {
  const normalizedPath = String(relativePath || '').replace(/\\/g, '/');
  const pathSegments = normalizedPath.split('/').filter(Boolean);
  const fileName = pathSegments[pathSegments.length - 1]?.toLowerCase() || '';

  return pathSegments.includes('__MACOSX')
    || fileName.startsWith('._')
    || fileName === '.ds_store'
    || fileName === 'thumbs.db'
    || fileName === 'desktop.ini';
}

function buildTree(files) {
  const root = createNode('', '');
  const index = new Map([['', root]]);

  files.forEach((item) => {
    const parts = item.relativePath.split('/');
    const filename = parts.pop();
    let runningPath = '';
    let parent = root;

    parts.forEach((part) => {
      runningPath = runningPath ? `${runningPath}/${part}` : part;
      let nextNode = index.get(runningPath);
      if (!nextNode) {
        nextNode = createNode(part, runningPath);
        parent.children.push(nextNode);
        index.set(runningPath, nextNode);
      }
      parent = nextNode;
    });

    parent.files.push({
      name: filename,
      relativePath: item.relativePath,
      size: item.size,
    });
  });

  function enrich(node) {
    let count = node.files.length;
    let folderCount = node === root ? 0 : 1;

    node.children.forEach((child) => {
      enrich(child);
      count += child.dicomCount;
      folderCount += child.folderCount;
    });

    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
    node.dicomCount = count;
    node.folderCount = folderCount;
  }

  enrich(root);
  return root;
}

function createFileManifestEntry(relativePath, size = 0) {
  return {
    path: String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, ''),
    size: Number(size) || 0,
  };
}

function createAnalysisSession({
  totalFiles = 0,
  files = [],
  ignoredFiles = [],
  uploadDirectory = null,
  sourceType = 'uploaded',
  sourcePath = '',
}) {
  const tree = buildTree(files);
  const sessionId = crypto.randomUUID();

  const session = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    totalFiles,
    uploadDirectory,
    files,
    ignoredFiles,
    tree,
    metadataCache: new Map(),
    importedStudyIds: new Set(),
    fileManifest: [
      ...files.map((file) => createFileManifestEntry(file.relativePath, file.size)),
      ...ignoredFiles.map((file) => createFileManifestEntry(file.relativePath, file.size)),
    ],
    sourceType,
    sourcePath,
  };

  setAnalysisSession(sessionId, session);
  return session;
}

function findNodeByPath(root, nodePath) {
  if (!nodePath) return root;

  const parts = nodePath.split('/');
  let current = root;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    current = current.children.find((child) => child.name === part);
    if (!current) return null;
  }

  return current;
}

function sortEntries(entries, sortBy, sortDir) {
  const direction = sortDir === 'desc' ? -1 : 1;
  const compareText = (left, right) => left.localeCompare(right) * direction;

  return [...entries].sort((left, right) => {
    if (sortBy === 'size') {
      const leftSize = left.size || 0;
      const rightSize = right.size || 0;
      if (leftSize !== rightSize) {
        return (leftSize - rightSize) * direction;
      }
      return compareText(left.name, right.name);
    }

    if (sortBy === 'dicomCount') {
      const leftCount = left.dicomCount || 0;
      const rightCount = right.dicomCount || 0;
      if (leftCount !== rightCount) {
        return (leftCount - rightCount) * direction;
      }
      return compareText(left.name, right.name);
    }

    if (sortBy === 'type') {
      if (left.type !== right.type) {
        return compareText(left.type, right.type);
      }
      return compareText(left.name, right.name);
    }

    return compareText(left.name, right.name);
  });
}

function toBreadcrumbParts(pathValue, isFile = false) {
  const parts = ['Root'];
  if (!pathValue) {
    return parts;
  }

  const normalizedParts = pathValue.split('/').filter(Boolean);
  return isFile ? [...parts, ...normalizedParts.slice(0, -1)] : [...parts, ...normalizedParts];
}

function collectRecursiveSearchEntries(node) {
  const results = [];

  node.children.forEach((child) => {
    results.push({
      type: 'folder',
      name: child.name,
      label: child.label,
      path: child.path,
      targetPath: child.path,
      dicomCount: child.dicomCount,
      folderCount: child.folderCount,
      breadcrumbParts: toBreadcrumbParts(child.path),
    });

    results.push(...collectRecursiveSearchEntries(child));
  });

  node.files.forEach((file) => {
    const targetPath = file.relativePath.split('/').slice(0, -1).join('/');
    results.push({
      type: 'file',
      name: file.name,
      relativePath: file.relativePath,
      targetPath,
      size: file.size || 0,
      breadcrumbParts: toBreadcrumbParts(file.relativePath, true),
      fileName: file.name,
    });
  });

  return results;
}

function buildCurrentFolderPayload({
  node,
  search = '',
  searchScope = 'descendants',
  extension = 'all',
  sizeRange = 'all',
  sortBy = 'name',
  sortDir = 'asc',
  page = 1,
  pageSize = 25,
}) {
  const normalizedSearch = search.trim().toLowerCase();

  const useDescendantSearch = normalizedSearch.length > 0 && searchScope === 'descendants';

  const folderEntries = node.children.map((child) => ({
    type: 'folder',
    name: child.name,
    label: child.label,
    path: child.path,
    targetPath: child.path,
    dicomCount: child.dicomCount,
    folderCount: child.folderCount,
  }));

  const fileEntries = node.files.map((file) => ({
    type: 'file',
    name: file.name,
    relativePath: file.relativePath,
    targetPath: file.relativePath.split('/').slice(0, -1).join('/'),
    size: file.size || 0,
  }));

  const directEntries = [...folderEntries, ...fileEntries];
  const searchedEntries = normalizedSearch.length > 0
    ? (
      useDescendantSearch
        ? collectRecursiveSearchEntries(node).filter((entry) => entry.name.toLowerCase().includes(normalizedSearch))
        : directEntries.filter((entry) => entry.name.toLowerCase().includes(normalizedSearch))
    )
    : directEntries;

  const extensionMatches = (entry) => {
    if (extension === 'all') {
      return true;
    }

    if (extension === 'folders') {
      return entry.type === 'folder';
    }

    if (entry.type !== 'file') {
      return false;
    }

    return entry.name.toLowerCase().endsWith(extension);
  };

  const sizeMatches = (entry) => {
    if (sizeRange === 'all' || entry.type !== 'file') {
      return true;
    }

    const fileSize = entry.size || 0;
    if (sizeRange === 'lt1mb') {
      return fileSize < 1024 * 1024;
    }

    if (sizeRange === '1to10mb') {
      return fileSize >= 1024 * 1024 && fileSize <= 10 * 1024 * 1024;
    }

    if (sizeRange === 'gt10mb') {
      return fileSize > 10 * 1024 * 1024;
    }

    return true;
  };

  const combinedSourceEntries = searchedEntries
    .filter((entry) => extensionMatches(entry))
    .filter((entry) => sizeMatches(entry));

  const combinedEntries = sortEntries(combinedSourceEntries, sortBy, sortDir);
  const totalResults = combinedEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageEntries = combinedEntries.slice(start, start + pageSize);

  return {
    currentFolder: {
      label: node.label,
      path: node.path,
      folderCount: node.children.length,
      fileCount: node.files.length,
      dicomCount: node.dicomCount,
    },
    controls: {
      search,
      searchScope,
      extension,
      sizeRange,
      sortBy,
      sortDir,
      page: safePage,
      pageSize,
      totalResults,
      totalPages,
      recursiveSearch: useDescendantSearch,
    },
    entries: pageEntries,
  };
}

function buildAnalysisSummary({ totalFiles, tree }) {
  return {
    totalFiles,
    dicomFiles: tree.dicomCount,
    folderCount: tree.folderCount,
  };
}

function buildIgnoredFileSummary(ignoredFiles = []) {
  const samplePaths = ignoredFiles
    .slice(0, 8)
    .map((file) => file.relativePath);
  const countsByExtension = ignoredFiles.reduce((accumulator, file) => {
    const extension = path.extname(file.relativePath || '').toLowerCase() || '[no extension]';
    accumulator[extension] = (accumulator[extension] || 0) + 1;
    return accumulator;
  }, {});

  return {
    ignoredFileCount: ignoredFiles.length,
    countsByExtension,
    samplePaths,
    hasMore: ignoredFiles.length > samplePaths.length,
  };
}

async function extractDicomMetadata(file) {
  const fileBuffer = await fs.readFile(resolveSessionFilePath(file));
  const dataSet = dicomParser.parseDicom(new Uint8Array(fileBuffer));

  return {
    studyInstanceUid: dataSet.string('x0020000d') || null,
    seriesInstanceUid: dataSet.string('x0020000e') || null,
    sopInstanceUid: dataSet.string('x00080018') || null,
    modality: dataSet.string('x00080060') || null,
    size: file.size || fileBuffer.byteLength || 0,
    relativePath: file.relativePath,
  };
}

async function getParsedDicomMetadata(session, file) {
  const cacheKey = `parsed-file:${file.relativePath}`;
  if (session.metadataCache.has(cacheKey)) {
    return session.metadataCache.get(cacheKey);
  }

  try {
    const parsedMetadata = await extractDicomMetadata(file);
    session.metadataCache.set(cacheKey, parsedMetadata);
    return parsedMetadata;
  } catch (_error) {
    session.metadataCache.set(cacheKey, null);
    return null;
  }
}

function getFilesForFolder(session, folderPath) {
  const normalizedPath = folderPath || '';
  if (!normalizedPath) {
    return session.files;
  }

  return session.files.filter((file) => (
    file.relativePath === normalizedPath
    || file.relativePath.startsWith(`${normalizedPath}/`)
  ));
}

function getUniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function summarizeUniqueValues(values) {
  const uniqueValues = getUniqueValues(values);

  return {
    values: uniqueValues,
    value: uniqueValues.length === 1 ? uniqueValues[0] : null,
    count: uniqueValues.length,
  };
}

async function buildMetadataSummaryForFile(session, relativePath) {
  const cacheKey = `file:${relativePath}`;
  if (session.metadataCache.has(cacheKey)) {
    return session.metadataCache.get(cacheKey);
  }

  const file = session.files.find((item) => item.relativePath === relativePath);
  if (!file) {
    throw createError.NotFound('Requested file metadata was not found in the analysis session');
  }

  const parsedMetadata = await getParsedDicomMetadata(session, file);
  if (!parsedMetadata) {
    throw createError.UnprocessableEntity('Selected file metadata could not be read');
  }
  const summary = {
    itemType: 'file',
    path: relativePath,
    metadata: {
      studyInstanceUid: parsedMetadata.studyInstanceUid,
      seriesInstanceUid: parsedMetadata.seriesInstanceUid,
      sopInstanceUid: parsedMetadata.sopInstanceUid,
      modality: parsedMetadata.modality,
      instanceCount: 1,
      totalSize: parsedMetadata.size,
    },
  };

  session.metadataCache.set(cacheKey, summary);
  return summary;
}

async function buildMetadataSummaryForFolder(session, folderPath) {
  const normalizedPath = folderPath || '';
  const cacheKey = `folder:${normalizedPath}`;
  if (session.metadataCache.has(cacheKey)) {
    return session.metadataCache.get(cacheKey);
  }

  const matchingFiles = getFilesForFolder(session, normalizedPath);
  if (matchingFiles.length === 0) {
    throw createError.NotFound('Requested folder metadata was not found in the analysis session');
  }

  const parsedMetadata = (await Promise.all(
    matchingFiles.map((file) => getParsedDicomMetadata(session, file)),
  )).filter(Boolean);
  if (parsedMetadata.length === 0) {
    throw createError.UnprocessableEntity('Selected folder metadata could not be read');
  }
  const studySummary = summarizeUniqueValues(parsedMetadata.map((item) => item.studyInstanceUid));
  const seriesSummary = summarizeUniqueValues(parsedMetadata.map((item) => item.seriesInstanceUid));
  const sopSummary = summarizeUniqueValues(parsedMetadata.map((item) => item.sopInstanceUid));
  const modalitySummary = summarizeUniqueValues(parsedMetadata.map((item) => item.modality));

  const summary = {
    itemType: 'folder',
    path: normalizedPath,
    metadata: {
      studyInstanceUid: studySummary.value,
      studyCount: studySummary.count,
      seriesInstanceUid: seriesSummary.value,
      seriesCount: seriesSummary.count,
      sopInstanceUid: sopSummary.value,
      sopCount: sopSummary.count,
      modality: modalitySummary.value,
      modalityCount: modalitySummary.count,
      instanceCount: parsedMetadata.length,
      totalSize: parsedMetadata.reduce((total, file) => total + (file.size || 0), 0),
    },
  };

  session.metadataCache.set(cacheKey, summary);
  return summary;
}

async function buildGroupedCurrentFolderPayload(session, nodePath) {
  const cacheKey = `grouped-folder:${nodePath || ''}`;
  if (session.metadataCache.has(cacheKey)) {
    return session.metadataCache.get(cacheKey);
  }

  const node = findNodeByPath(session.tree, nodePath || '');
  if (!node) {
    throw createError.NotFound('Requested folder path was not found in the analysis session');
  }

  const directFiles = session.files.filter((file) => (
    file.relativePath.split('/').slice(0, -1).join('/') === (nodePath || '')
  ));

  const parsedFiles = (await Promise.all(directFiles.map(async (file) => {
    const parsedMetadata = await getParsedDicomMetadata(session, file);
    if (!parsedMetadata) {
      return null;
    }

    return {
      ...file,
      ...parsedMetadata,
    };
  }))).filter(Boolean);

  const studiesByUid = new Map();

  parsedFiles.forEach((file) => {
    const studyKey = file.studyInstanceUid || 'Unknown Study';
    if (!studiesByUid.has(studyKey)) {
      studiesByUid.set(studyKey, {
        studyInstanceUid: file.studyInstanceUid || null,
        series: new Map(),
        instanceCount: 0,
        totalSize: 0,
      });
    }

    const studyGroup = studiesByUid.get(studyKey);
    const seriesKey = file.seriesInstanceUid || 'Unknown Series';
    if (!studyGroup.series.has(seriesKey)) {
      studyGroup.series.set(seriesKey, {
        seriesInstanceUid: file.seriesInstanceUid || null,
        modality: file.modality || null,
        files: [],
        instanceCount: 0,
        totalSize: 0,
      });
    }

    const seriesGroup = studyGroup.series.get(seriesKey);
    seriesGroup.files.push({
      name: file.name,
      relativePath: file.relativePath,
      size: file.size || 0,
      sopInstanceUid: file.sopInstanceUid || null,
    });
    seriesGroup.instanceCount += 1;
    seriesGroup.totalSize += file.size || 0;

    studyGroup.instanceCount += 1;
    studyGroup.totalSize += file.size || 0;
  });

  const studies = [...studiesByUid.values()].map((studyGroup) => {
    const series = [...studyGroup.series.values()]
      .map((seriesGroup) => ({
        ...seriesGroup,
        files: seriesGroup.files.sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .sort((left, right) => (
        (left.seriesInstanceUid || left.files[0]?.name || '').localeCompare(
          right.seriesInstanceUid || right.files[0]?.name || '',
        )
      ));

    return {
      studyInstanceUid: studyGroup.studyInstanceUid,
      series,
      seriesCount: series.length,
      instanceCount: studyGroup.instanceCount,
      totalSize: studyGroup.totalSize,
    };
  }).sort((left, right) => (
    (left.studyInstanceUid || '').localeCompare(right.studyInstanceUid || '')
  ));

  const payload = {
    path: nodePath || '',
    directFileCount: directFiles.length,
    studyCount: studies.length,
    studies,
  };

  session.metadataCache.set(cacheKey, payload);
  return payload;
}

function buildAnalysisPayload(session) {
  return {
    sessionId: session.id,
    summary: buildAnalysisSummary({
      totalFiles: session.totalFiles,
      tree: session.tree,
    }),
    ignoredFiles: buildIgnoredFileSummary(session.ignoredFiles),
    tree: session.tree,
    fileManifest: session.fileManifest || [],
    sourceType: session.sourceType || 'uploaded',
    sourcePath: session.sourcePath || '',
  };
}

function readOrthancStatistic(source, keys = []) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (source[key] !== undefined && source[key] !== null) {
      return Number(source[key]) || 0;
    }
  }

  return null;
}

async function buildUsagePayload(session) {
  const usesApiStaging = session.sourceType !== 'mounted-path';
  const stagedDicomBytes = usesApiStaging
    ? session.files.reduce((total, file) => total + (file.size || 0), 0)
    : 0;
  const stagedDicomCount = usesApiStaging ? session.files.length : 0;
  const importedStudyCount = session.importedStudyIds.size;

  let orthancStats = {
    available: false,
    studyCount: null,
    seriesCount: null,
    instanceCount: null,
    diskBytes: null,
  };

  try {
    const response = await orthanc.get('/statistics');
    const statistics = response.data || {};
    orthancStats = {
      available: true,
      studyCount: readOrthancStatistic(statistics, ['CountStudies', 'StudiesCount']),
      seriesCount: readOrthancStatistic(statistics, ['CountSeries', 'SeriesCount']),
      instanceCount: readOrthancStatistic(statistics, ['CountInstances', 'InstancesCount']),
      diskBytes: readOrthancStatistic(statistics, [
        'TotalDiskSize',
        'DiskSize',
        'TotalDiskSizeInBytes',
      ]),
    };
  } catch (_error) {
    orthancStats = {
      available: false,
      studyCount: null,
      seriesCount: null,
      instanceCount: null,
      diskBytes: null,
    };
  }

  return {
    sessionId: session.id,
    collectedAt: new Date().toISOString(),
    sourceType: session.sourceType || 'uploaded',
    staging: {
      stagedDicomCount,
      stagedDicomBytes,
    },
    orthanc: {
      ...orthancStats,
      importedStudyCount,
    },
  };
}

async function cleanupUploadedFiles(files) {
  await Promise.all(
    files
      .filter((file) => file?.storedPath)
      .map((file) => fs.rm(file.storedPath, { force: true })),
  );
}

async function cleanupUploadDirectory(uploadDirectory) {
  if (!uploadDirectory) {
    return;
  }

  await fs.rm(uploadDirectory, { recursive: true, force: true });
}

async function importStoredFiles(files, options = {}) {
  const onFileProcessed = typeof options.onFileProcessed === 'function'
    ? options.onFileProcessed
    : null;
  const importedStudies = new Map();
  const importedFiles = [];
  const skippedFiles = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    try {
      const payload = await fs.readFile(resolveSessionFilePath(file));
      const uploadResponse = await orthanc.post('/instances', payload, {
        headers: {
          'Content-Type': 'application/dicom',
        },
      });

      const orthancInstanceId = uploadResponse.data.ID;
      const parentStudyId = uploadResponse.data.ParentStudy;
      const parentSeriesId = uploadResponse.data.ParentSeries;

      if (!parentStudyId) {
        skippedFiles.push(file.relativePath);
        continue;
      }

      const studyResponse = await orthanc.get(`/studies/${parentStudyId}`);
      const studyUid = studyResponse.data?.MainDicomTags?.StudyInstanceUID || parentStudyId;
      const seriesResponse = parentSeriesId
        ? await orthanc.get(`/series/${parentSeriesId}`)
        : null;
      const seriesUid = seriesResponse?.data?.MainDicomTags?.SeriesInstanceUID || parentSeriesId || null;
      const instanceTagsResponse = orthancInstanceId
        ? await orthanc.get(`/instances/${orthancInstanceId}/simplified-tags`)
        : null;
      const sopInstanceUid = instanceTagsResponse?.data?.SOPInstanceUID || null;

      importedStudies.set(studyUid, {
        studyUid,
        studyId: parentStudyId,
        lastImportedPath: file.relativePath,
      });

      importedFiles.push({
        relativePath: file.relativePath,
        studyUid,
        seriesUid,
        sopInstanceUid,
      });

      if (onFileProcessed) {
        await onFileProcessed({
          file,
          index,
          completedFiles: importedFiles.length,
          failedFiles: skippedFiles.length,
          status: 'imported',
        });
      }
    } catch (_error) {
      skippedFiles.push(file.relativePath);

      if (onFileProcessed) {
        await onFileProcessed({
          file,
          index,
          completedFiles: importedFiles.length,
          failedFiles: skippedFiles.length,
          status: 'failed',
        });
      }
    }
  }

  return {
    importedFileCount: importedFiles.length,
    skippedFileCount: skippedFiles.length,
    importedPaths: importedFiles,
    skippedPaths: skippedFiles,
    studies: [...importedStudies.values()],
  };
}

function resolveFilesForImport(session, relativePaths = []) {
  const requestedPaths = Array.isArray(relativePaths) ? relativePaths : [];

  return requestedPaths.length > 0
    ? session.files.filter((file) => requestedPaths.includes(file.relativePath))
    : session.files;
}

function createImportSessionJob(session, filesToImport) {
  return createImportJob({
    sessionId: session.id,
    totalFiles: filesToImport.length,
  });
}

function applyImportResultToSession(session, result) {
  result.studies.forEach((study) => {
    if (study.studyId) {
      session.importedStudyIds.add(study.studyId);
    }
  });

  return {
    ...result,
    sessionId: session.id,
    importedStudyCount: session.importedStudyIds.size,
  };
}

async function executeImportSessionJob(job, session, filesToImport) {
  startImportJob(job.jobId, {
    currentFilePath: filesToImport[0]?.relativePath || '',
  });

  try {
    const result = await importStoredFiles(filesToImport, {
      onFileProcessed: ({ completedFiles, failedFiles, index }) => {
        const nextFile = filesToImport[index + 1];
        setImportJobProgress(job.jobId, {
          completedFiles,
          failedFiles,
          currentFilePath: nextFile?.relativePath || '',
        });
      },
    });
    const finalizedResult = applyImportResultToSession(session, result);
    completeImportJob(job.jobId, finalizedResult);
    return finalizedResult;
  } catch (error) {
    failImportJob(job.jobId, error);
    return null;
  }
}

function getSessionOrThrow(sessionId) {
  const session = getAnalysisSession(sessionId);
  if (!session) {
    throw createError.NotFound('Analysis session not found');
  }
  return session;
}

async function clearStudiesById(studyIds = []) {
  const uniqueStudyIds = [...new Set(studyIds.filter(Boolean))];

  await Promise.all(uniqueStudyIds.map(async (studyId) => {
    try {
      await orthanc.delete(`/studies/${studyId}`);
    } catch (_error) {
      // Ignore missing/deleted studies so cleanup stays idempotent.
    }
  }));

  return uniqueStudyIds.length;
}

function sanitizeDownloadName(value, fallback = 'dicom-selection') {
  const normalized = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || fallback;
}

function buildContentDisposition(filename) {
  const encodedFilename = encodeURIComponent(filename);
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;
}

function toTarOctal(value, size) {
  const octal = Math.max(0, value).toString(8);
  return `${octal}`.padStart(size - 1, '0');
}

function splitTarPath(pathValue) {
  const normalizedPath = String(pathValue || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  if (Buffer.byteLength(normalizedPath) <= 100) {
    return {
      name: normalizedPath,
      prefix: '',
    };
  }

  const parts = normalizedPath.split('/');
  const name = parts.pop() || 'file.dcm';
  const prefix = parts.join('/');

  if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) {
    return { name, prefix };
  }

  const extension = path.extname(name);
  const stem = path.basename(name, extension).slice(0, Math.max(1, 90 - extension.length));
  const fallbackName = `${stem}${extension}`.slice(0, 100);

  return {
    name: fallbackName,
    prefix: '',
  };
}

function createTarHeader(entryName, size) {
  const { name, prefix } = splitTarPath(entryName);
  const header = Buffer.alloc(512, 0);

  header.write(name, 0, 100, 'utf8');
  header.write(toTarOctal(0o644, 8), 100, 8, 'ascii');
  header.write(toTarOctal(0, 8), 108, 8, 'ascii');
  header.write(toTarOctal(0, 8), 116, 8, 'ascii');
  header.write(toTarOctal(size, 12), 124, 12, 'ascii');
  header.write(toTarOctal(Math.floor(Date.now() / 1000), 12), 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar', 257, 5, 'ascii');
  header.write('00', 263, 2, 'ascii');
  header.write(prefix, 345, 155, 'utf8');

  let checksum = 0;
  for (let index = 0; index < 512; index += 1) {
    checksum += header[index];
  }
  header.write(`${toTarOctal(checksum, 8)}\0`, 148, 8, 'ascii');

  return header;
}

async function streamTarArchive(res, files, options = {}) {
  const archiveName = `${sanitizeDownloadName(options.archiveName || 'dicom-selection')}.tar`;
  const basePath = String(options.basePath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const archiveRoot = sanitizeDownloadName(options.archiveRoot || options.archiveName || 'dicom-selection');

  res.setHeader('Content-Type', 'application/x-tar');
  res.setHeader('Content-Disposition', buildContentDisposition(archiveName));

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const baseRelativePath = file.relativePath.replace(/\\/g, '/');
    const nestedPath = basePath && baseRelativePath.startsWith(`${basePath}/`)
      ? baseRelativePath.slice(basePath.length + 1)
      : path.basename(baseRelativePath);
    const archiveEntryPath = archiveRoot
      ? `${archiveRoot}/${nestedPath}`
      : nestedPath;
    const fileBuffer = await fs.readFile(resolveSessionFilePath(file));

    res.write(createTarHeader(archiveEntryPath, fileBuffer.length));
    res.write(fileBuffer);

    const remainder = fileBuffer.length % 512;
    if (remainder > 0) {
      res.write(Buffer.alloc(512 - remainder, 0));
    }
  }

  res.end(Buffer.alloc(1024, 0));
}

router.get('/bootstrap', asyncHandler(async (req, res) => {
  res.json({
    user: req.user,
    viewerOpenMode: 'same-tab',
    localOnly: true,
  });
}));

router.post(
  '/analyze',
  accessControl('dicom_viewer', 'read'),
  upload.array('files', 10000),
  asyncHandler(async (req, res) => {
    const uploadedFiles = req.files || [];
    if (uploadedFiles.length === 0) {
      throw createError.BadRequest('No files were uploaded for analysis');
    }

    const relativePathsRaw = req.body.relativePaths || [];
    const relativePaths = Array.isArray(relativePathsRaw) ? relativePathsRaw : [relativePathsRaw];

    const dicomFiles = [];
    const nonDicomFiles = [];

    for (let index = 0; index < uploadedFiles.length; index += 1) {
      const uploadedFile = uploadedFiles[index];
      const relativePath = relativePaths[index] || uploadedFile.originalname;

      if (shouldIgnoreUploadPath(relativePath) || !relativePath.toLowerCase().endsWith('.dcm')) {
        nonDicomFiles.push({
          storedPath: uploadedFile.path,
          relativePath,
          size: uploadedFile.size || 0,
        });
        continue;
      }

      dicomFiles.push({
        name: path.basename(relativePath),
        relativePath,
        storedPath: uploadedFile.path,
        size: uploadedFile.size,
        sourceKind: 'uploaded',
      });
    }

    if (nonDicomFiles.length > 0) {
      await cleanupUploadedFiles(nonDicomFiles);
    }

    const session = createAnalysisSession({
      totalFiles: uploadedFiles.length,
      uploadDirectory: req.uploadDirectory,
      files: dicomFiles,
      ignoredFiles: nonDicomFiles,
      sourceType: 'uploaded',
      sourcePath: '',
    });

    res.json(buildAnalysisPayload(session));
  }),
);

router.post(
  '/analyze-path',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const sourcePath = String(req.body?.sourcePath || '').trim();
    if (!sourcePath) {
      throw createError.BadRequest('sourcePath is required');
    }

    let mappings;
    try {
      mappings = getSourceRootMappings();
    } catch (error) {
      throw createError.InternalServerError(error.message);
    }

    if (!mappings.length) {
      throw createError.BadRequest(
        'Direct path upload is not configured yet. Add SOURCE_ROOT_MAPPINGS and matching Docker volume mounts first.',
      );
    }

    const resolvedPath = mapHostPathToContainer(sourcePath, mappings);
    if (!resolvedPath) {
      throw createError.BadRequest(
        'The selected path is outside the configured local source roots or is not an absolute Windows, macOS, or Linux path.',
      );
    }

    let scannedSource;
    try {
      scannedSource = await scanSourceDirectory(resolvedPath.containerPath);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EPERM') {
        throw createError.BadRequest(
          'The selected path does not exist or is not accessible from the local API container.',
        );
      }

      throw error;
    }

    if (scannedSource.totalFiles === 0) {
      throw createError.BadRequest('The selected path does not contain any files to analyze.');
    }

    const session = createAnalysisSession({
      totalFiles: scannedSource.totalFiles,
      files: scannedSource.dicomFiles,
      ignoredFiles: scannedSource.ignoredFiles,
      uploadDirectory: null,
      sourceType: 'mounted-path',
      sourcePath,
    });

    session.fileManifest = scannedSource.fileManifest;

    res.json(buildAnalysisPayload(session));
  }),
);

router.get(
  '/import-progress',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const { jobId } = req.query;
    if (!jobId) {
      throw createError.BadRequest('jobId is required');
    }

    const importJob = getImportJob(String(jobId));
    if (!importJob) {
      throw createError.NotFound('Import job not found');
    }

    res.json(importJob);
  }),
);

router.get(
  '/session',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    const session = getSessionOrThrow(String(sessionId));
    res.json(buildAnalysisPayload(session));
  }),
);

router.get(
  '/session-availability',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    res.json({
      sessionId: String(sessionId),
      available: hasAnalysisSession(String(sessionId)),
    });
  }),
);

router.get(
  '/usage',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    const session = getSessionOrThrow(String(sessionId));
    res.json(await buildUsagePayload(session));
  }),
);

router.get(
  '/metadata-summary',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const {
      sessionId,
      itemType = 'folder',
      path: itemPath = '',
    } = req.query;

    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    const session = getSessionOrThrow(String(sessionId));
    const summary = String(itemType) === 'file'
      ? await buildMetadataSummaryForFile(session, String(itemPath))
      : await buildMetadataSummaryForFolder(session, String(itemPath));

    res.json(summary);
  }),
);

router.get(
  '/current-folder-groups',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const {
      sessionId,
      path: nodePath = '',
    } = req.query;

    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    const session = getSessionOrThrow(String(sessionId));
    const payload = await buildGroupedCurrentFolderPayload(session, String(nodePath));
    res.json(payload);
  }),
);

router.post(
  '/import-session',
  accessControl('dicom_viewer', 'update'),
  asyncHandler(async (req, res) => {
    const { sessionId, relativePaths = [] } = req.body || {};
    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    const session = getSessionOrThrow(sessionId);
    const filesToImport = resolveFilesForImport(session, relativePaths);

    if (filesToImport.length === 0) {
      throw createError.BadRequest('No analyzed DICOM files matched the requested selection');
    }

    const importJob = createImportSessionJob(session, filesToImport);
    void executeImportSessionJob(importJob, session, filesToImport);

    res.status(202).json({
      jobId: importJob.jobId,
      sessionId: session.id,
      status: importJob.status,
      totalFiles: importJob.totalFiles,
      completedFiles: importJob.completedFiles,
      failedFiles: importJob.failedFiles,
      percentComplete: importJob.percentComplete,
    });
  }),
);

router.post(
  '/download-selection',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const {
      sessionId,
      relativePaths = [],
      downloadName = 'dicom-selection',
      basePath = '',
      archiveRoot = '',
    } = req.body || {};

    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    const requestedPaths = Array.isArray(relativePaths) ? relativePaths : [];
    const session = getSessionOrThrow(sessionId);
    const filesToDownload = requestedPaths.length > 0
      ? session.files.filter((file) => requestedPaths.includes(file.relativePath))
      : session.files;

    if (filesToDownload.length === 0) {
      throw createError.BadRequest('No analyzed DICOM files matched the requested download selection');
    }

    if (filesToDownload.length === 1) {
      const file = filesToDownload[0];
      const filename = sanitizeDownloadName(
        path.basename(file.relativePath),
        'dicom-file.dcm',
      );

      res.setHeader('Content-Type', 'application/dicom');
      res.setHeader('Content-Disposition', buildContentDisposition(filename));
      res.sendFile(resolveSessionFilePath(file));
      return;
    }

    await streamTarArchive(res, filesToDownload, {
      archiveName: downloadName,
      basePath,
      archiveRoot,
    });
  }),
);

router.post(
  '/clear-session',
  accessControl('dicom_viewer', 'update'),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    const session = getSessionOrThrow(sessionId);
    const clearedStudyCount = await clearStudiesById([...session.importedStudyIds]);
    session.importedStudyIds = new Set();
    await cleanupUploadDirectory(session.uploadDirectory);
    deleteAnalysisSession(sessionId);

    res.json({
      cleared: true,
      sessionId,
      clearedStudyCount,
    });
  }),
);

router.post(
  '/clear-imported-studies',
  accessControl('dicom_viewer', 'update'),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    const session = getSessionOrThrow(sessionId);
    const clearedStudyCount = await clearStudiesById([...session.importedStudyIds]);
    session.importedStudyIds = new Set();

    res.json({
      cleared: true,
      sessionId,
      clearedStudyCount,
    });
  }),
);

router.get(
  '/current-folder',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const {
      sessionId,
      path: nodePath = '',
      search = '',
      searchScope = 'descendants',
      extension = 'all',
      sizeRange = 'all',
      sortBy = 'name',
      sortDir = 'asc',
      page = '1',
      pageSize = '25',
    } = req.query;

    if (!sessionId) {
      throw createError.BadRequest('sessionId is required');
    }

    const session = getSessionOrThrow(sessionId);
    const node = findNodeByPath(session.tree, nodePath);

    if (!node) {
      throw createError.NotFound('Requested folder path was not found in the analysis session');
    }

    const allowedPageSizes = new Set([25, 50, 100]);
    const parsedPageSize = Number(pageSize);
    const safePageSize = allowedPageSizes.has(parsedPageSize) ? parsedPageSize : 25;

    res.json(buildCurrentFolderPayload({
      node,
      search: String(search),
      searchScope: String(searchScope) === 'current' ? 'current' : 'descendants',
      extension: String(extension),
      sizeRange: String(sizeRange),
      sortBy: String(sortBy),
      sortDir: String(sortDir) === 'desc' ? 'desc' : 'asc',
      page: Number(page) || 1,
      pageSize: safePageSize,
    }));
  }),
);

module.exports = router;
