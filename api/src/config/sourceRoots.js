const path = require('path');

function normalizeContainerPath(value) {
  const normalized = path.posix.normalize(String(value || '').trim().replace(/\\/g, '/'));
  if (!normalized || !normalized.startsWith('/')) {
    throw new Error('containerPath must be an absolute Linux path');
  }

  return normalized !== '/' ? normalized.replace(/\/+$/, '') : normalized;
}

function sanitizeMapping(entry, index) {
  const hostPath = String(entry?.hostPath || '').trim();
  const containerPath = normalizeContainerPath(entry?.containerPath);

  if (!hostPath) {
    throw new Error(`source root mapping at index ${index} is missing hostPath`);
  }

  return {
    id: String(entry?.id || `root${index}`),
    hostPath,
    containerPath,
    label: String(entry?.label || entry?.hostPath || `root${index}`),
  };
}

function getSourceRootMappings() {
  const rawMappings = String(process.env.SOURCE_ROOT_MAPPINGS || '').trim();

  if (rawMappings) {
    let parsedMappings;
    try {
      parsedMappings = JSON.parse(rawMappings);
    } catch (error) {
      throw new Error(`SOURCE_ROOT_MAPPINGS must be valid JSON: ${error.message}`);
    }

    if (!Array.isArray(parsedMappings)) {
      throw new Error('SOURCE_ROOT_MAPPINGS must be a JSON array');
    }

    return parsedMappings.map((entry, index) => sanitizeMapping(entry, index));
  }

  if (process.env.HOST_SOURCE_ROOT && process.env.CONTAINER_SOURCE_ROOT) {
    return [
      sanitizeMapping(
        {
          id: 'root0',
          hostPath: process.env.HOST_SOURCE_ROOT,
          containerPath: process.env.CONTAINER_SOURCE_ROOT,
          label: process.env.HOST_SOURCE_ROOT,
        },
        0,
      ),
    ];
  }

  return [];
}

module.exports = {
  getSourceRootMappings,
};
