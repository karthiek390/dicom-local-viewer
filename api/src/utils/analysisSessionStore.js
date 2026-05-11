const analysisSessions = new Map();

function setAnalysisSession(sessionId, session) {
  analysisSessions.set(sessionId, session);
  return session;
}

function getAnalysisSession(sessionId) {
  return analysisSessions.get(sessionId) || null;
}

function hasAnalysisSession(sessionId) {
  return analysisSessions.has(sessionId);
}

function deleteAnalysisSession(sessionId) {
  return analysisSessions.delete(sessionId);
}

module.exports = {
  setAnalysisSession,
  getAnalysisSession,
  hasAnalysisSession,
  deleteAnalysisSession,
};
