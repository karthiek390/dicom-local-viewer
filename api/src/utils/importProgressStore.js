const crypto = require('crypto');
const {
  TERMINAL_IMPORT_JOB_STATUSES,
  buildImportProgressSnapshot,
  createQueuedImportJob,
  markImportJobRunning,
  updateImportJobProgress,
  markImportJobCompleted,
  markImportJobFailed,
  markImportJobCanceled,
} = require('./importProgressModel');

const importJobs = new Map();
const COMPLETED_IMPORT_JOB_TTL_MS = 10 * 60 * 1000;

function getJobExpirationTime(job) {
  const snapshot = buildImportProgressSnapshot(job);
  if (!TERMINAL_IMPORT_JOB_STATUSES.has(snapshot.status)) {
    return null;
  }

  const finishedAtMs = snapshot.finishedAt ? Date.parse(snapshot.finishedAt) : NaN;
  if (!Number.isFinite(finishedAtMs)) {
    return Date.now() + COMPLETED_IMPORT_JOB_TTL_MS;
  }

  return finishedAtMs + COMPLETED_IMPORT_JOB_TTL_MS;
}

function isImportJobExpired(job, now = Date.now()) {
  const expirationTime = getJobExpirationTime(job);
  return Number.isFinite(expirationTime) ? expirationTime <= now : false;
}

function pruneExpiredImportJobs(now = Date.now()) {
  let removedCount = 0;

  for (const [jobId, job] of importJobs.entries()) {
    if (isImportJobExpired(job, now)) {
      importJobs.delete(jobId);
      removedCount += 1;
    }
  }

  return removedCount;
}

function setImportJob(job) {
  pruneExpiredImportJobs();
  const snapshot = buildImportProgressSnapshot(job);
  importJobs.set(snapshot.jobId, snapshot);
  return snapshot;
}

function createImportJob({ sessionId, totalFiles }) {
  const job = createQueuedImportJob({
    jobId: `import-${crypto.randomUUID()}`,
    sessionId,
    totalFiles,
  });

  return setImportJob(job);
}

function getImportJob(jobId) {
  pruneExpiredImportJobs();
  if (!jobId) {
    return null;
  }

  const job = importJobs.get(String(jobId));
  return job ? buildImportProgressSnapshot(job) : null;
}

function requireImportJob(jobId) {
  const job = getImportJob(jobId);
  if (!job) {
    return null;
  }

  return job;
}

function updateImportJob(jobId, updater) {
  const currentJob = requireImportJob(jobId);
  if (!currentJob) {
    return null;
  }

  const nextJob = typeof updater === 'function'
    ? updater(currentJob)
    : currentJob;

  return setImportJob(nextJob);
}

function startImportJob(jobId, options = {}) {
  return updateImportJob(jobId, (job) => markImportJobRunning(job, options));
}

function setImportJobProgress(jobId, progressUpdate = {}) {
  return updateImportJob(jobId, (job) => updateImportJobProgress(job, progressUpdate));
}

function completeImportJob(jobId, result = {}) {
  return updateImportJob(jobId, (job) => markImportJobCompleted(job, result));
}

function failImportJob(jobId, error) {
  return updateImportJob(jobId, (job) => markImportJobFailed(job, error));
}

function cancelImportJob(jobId, message) {
  return updateImportJob(jobId, (job) => markImportJobCanceled(job, message));
}

function deleteImportJob(jobId) {
  pruneExpiredImportJobs();
  if (!jobId) {
    return false;
  }

  return importJobs.delete(String(jobId));
}

function listImportJobs() {
  pruneExpiredImportJobs();
  return [...importJobs.values()].map((job) => buildImportProgressSnapshot(job));
}

module.exports = {
  COMPLETED_IMPORT_JOB_TTL_MS,
  createImportJob,
  getImportJob,
  startImportJob,
  setImportJobProgress,
  completeImportJob,
  failImportJob,
  cancelImportJob,
  deleteImportJob,
  listImportJobs,
  pruneExpiredImportJobs,
};
