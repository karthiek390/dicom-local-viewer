const path = require('path');

function inferHostPathStyle(value) {
  const input = String(value || '').trim();

  if (/^[A-Za-z]:[\\/]/.test(input)) {
    return 'windows';
  }

  if (input.startsWith('/')) {
    return 'posix';
  }

  return '';
}

function trimTrailingSeparator(value, style) {
  if (style === 'windows') {
    if (/^[A-Za-z]:\\$/.test(value)) {
      return value;
    }

    return value.replace(/\\+$/, '');
  }

  if (value === '/') {
    return value;
  }

  return value.replace(/\/+$/, '');
}

function normalizeHostPath(value, style = inferHostPathStyle(value)) {
  const input = String(value || '').trim();
  if (!input) {
    return '';
  }

  if (style === 'windows') {
    const normalized = path.win32.normalize(input.replace(/\//g, '\\'));
    if (!path.win32.isAbsolute(normalized)) {
      return '';
    }

    return trimTrailingSeparator(normalized, 'windows');
  }

  if (style === 'posix') {
    const normalized = path.posix.normalize(input.replace(/\\/g, '/'));
    if (!path.posix.isAbsolute(normalized)) {
      return '';
    }

    return trimTrailingSeparator(normalized, 'posix');
  }

  return '';
}

function normalizeForCompare(value, style) {
  const normalized = normalizeHostPath(value, style);
  return style === 'windows' ? normalized.toLowerCase() : normalized;
}

function splitRelativeSegments(value, style) {
  if (!value) {
    return [];
  }

  return value
    .split(style === 'windows' ? '\\' : '/')
    .filter(Boolean);
}

function mapHostPathToContainer(hostPath, mappings) {
  const style = inferHostPathStyle(hostPath);
  if (!style) {
    return null;
  }

  const normalizedTarget = normalizeHostPath(hostPath, style);
  const comparableTarget = normalizeForCompare(normalizedTarget, style);

  if (!normalizedTarget || !comparableTarget) {
    return null;
  }

  for (let index = 0; index < mappings.length; index += 1) {
    const mapping = mappings[index];
    const mappingStyle = inferHostPathStyle(mapping.hostPath);
    if (mappingStyle !== style) {
      continue;
    }

    const normalizedRoot = normalizeHostPath(mapping.hostPath, mappingStyle);
    const comparableRoot = normalizeForCompare(normalizedRoot, mappingStyle);
    if (!normalizedRoot || !comparableRoot) {
      continue;
    }

    const relativePath = mappingStyle === 'windows'
      ? path.win32.relative(normalizedRoot, normalizedTarget)
      : path.posix.relative(normalizedRoot, normalizedTarget);

    if (
      relativePath.startsWith('..')
      || relativePath === '..'
      || (mappingStyle === 'windows' ? path.win32.isAbsolute(relativePath) : path.posix.isAbsolute(relativePath))
    ) {
      continue;
    }

    const containerPath = path.posix.join(
      mapping.containerPath,
      ...splitRelativeSegments(relativePath, mappingStyle),
    );

    return {
      mapping,
      hostPath: normalizedTarget,
      containerPath,
      style,
      comparableRoot,
      comparableTarget,
    };
  }

  return null;
}

module.exports = {
  inferHostPathStyle,
  normalizeHostPath,
  mapHostPathToContainer,
};
