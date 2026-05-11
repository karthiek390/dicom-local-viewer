const IMPORT_JOB_STATUS = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled',
});

const TERMINAL_IMPORT_JOB_STATUSES = new Set([
  IMPORT_JOB_STATUS.COMPLETED,
  IMPORT_JOB_STATUS.FAILED,
  IMPORT_JOB_STATUS.CANCELED,
]);

function clampCount(value) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue < 0) {
    return 0;
  }

  return Math.floor(nextValue);
}

function buildImportProgressSnapshot(job) {
  const totalFiles = clampCount(job.totalFiles);
  const completedFiles = Math.min(clampCount(job.completedFiles), totalFiles);
  const failedFiles = clampCount(job.failedFiles);
  const percentComplete = totalFiles > 0
    ? Math.min(100, Math.round((completedFiles / totalFiles) * 100))
    : 0;

  return {
    jobId: String(job.jobId || ''),
    sessionId: String(job.sessionId || ''),
    status: Object.values(IMPORT_JOB_STATUS).includes(job.status)
      ? job.status
      : IMPORT_JOB_STATUS.QUEUED,
    totalFiles,
    completedFiles,
    failedFiles,
    pendingFiles: Math.max(totalFiles - completedFiles - failedFiles, 0),
    percentComplete,
    currentFilePath: String(job.currentFilePath || ''),
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    errorMessage: job.errorMessage ? String(job.errorMessage) : null,
    importedFileCount: clampCount(job.importedFileCount),
    skippedFileCount: clampCount(job.skippedFileCount),
    importedStudyCount: clampCount(job.importedStudyCount),
    importedPaths: Array.isArray(job.importedPaths) ? job.importedPaths : [],
    studies: Array.isArray(job.studies) ? job.studies : [],
  };
}

function createQueuedImportJob({ jobId, sessionId, totalFiles }) {
  return buildImportProgressSnapshot({
    jobId,
    sessionId,
    status: IMPORT_JOB_STATUS.QUEUED,
    totalFiles,
    completedFiles: 0,
    failedFiles: 0,
    currentFilePath: '',
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    importedFileCount: 0,
    skippedFileCount: 0,
    importedStudyCount: 0,
    importedPaths: [],
    studies: [],
  });
}

function markImportJobRunning(job, { currentFilePath = '' } = {}) {
  const snapshot = buildImportProgressSnapshot(job);

  return buildImportProgressSnapshot({
    ...snapshot,
    status: IMPORT_JOB_STATUS.RUNNING,
    currentFilePath,
    startedAt: snapshot.startedAt || new Date().toISOString(),
    finishedAt: null,
    errorMessage: null,
  });
}

function updateImportJobProgress(job, {
  completedFiles,
  failedFiles,
  currentFilePath,
} = {}) {
  const snapshot = buildImportProgressSnapshot(job);

  return buildImportProgressSnapshot({
    ...snapshot,
    status: snapshot.status === IMPORT_JOB_STATUS.QUEUED
      ? IMPORT_JOB_STATUS.RUNNING
      : snapshot.status,
    completedFiles: completedFiles ?? snapshot.completedFiles,
    failedFiles: failedFiles ?? snapshot.failedFiles,
    currentFilePath: currentFilePath ?? snapshot.currentFilePath,
    startedAt: snapshot.startedAt || new Date().toISOString(),
  });
}

function markImportJobCompleted(job, {
  importedFileCount,
  skippedFileCount,
  importedStudyCount,
  importedPaths = [],
  studies = [],
} = {}) {
  const snapshot = buildImportProgressSnapshot(job);

  return buildImportProgressSnapshot({
    ...snapshot,
    status: IMPORT_JOB_STATUS.COMPLETED,
    completedFiles: snapshot.totalFiles,
    currentFilePath: '',
    finishedAt: new Date().toISOString(),
    errorMessage: null,
    importedFileCount: importedFileCount ?? snapshot.importedFileCount,
    skippedFileCount: skippedFileCount ?? snapshot.skippedFileCount,
    importedStudyCount: importedStudyCount ?? snapshot.importedStudyCount,
    importedPaths,
    studies,
  });
}

function markImportJobFailed(job, error) {
  const snapshot = buildImportProgressSnapshot(job);
  const errorMessage = error instanceof Error ? error.message : String(error || 'Import failed');

  return buildImportProgressSnapshot({
    ...snapshot,
    status: IMPORT_JOB_STATUS.FAILED,
    currentFilePath: '',
    finishedAt: new Date().toISOString(),
    errorMessage,
  });
}

function markImportJobCanceled(job, message = 'Import was canceled') {
  const snapshot = buildImportProgressSnapshot(job);

  return buildImportProgressSnapshot({
    ...snapshot,
    status: IMPORT_JOB_STATUS.CANCELED,
    currentFilePath: '',
    finishedAt: new Date().toISOString(),
    errorMessage: message,
  });
}

module.exports = {
  IMPORT_JOB_STATUS,
  TERMINAL_IMPORT_JOB_STATUSES,
  buildImportProgressSnapshot,
  createQueuedImportJob,
  markImportJobRunning,
  updateImportJobProgress,
  markImportJobCompleted,
  markImportJobFailed,
  markImportJobCanceled,
};
