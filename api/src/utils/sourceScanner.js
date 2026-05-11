const fs = require('fs/promises');
const path = require('path');

async function scanSourceDirectory(rootPath) {
  const stat = await fs.stat(rootPath);
  if (!stat.isDirectory()) {
    throw new Error('The selected path is not a directory');
  }

  const dicomFiles = [];
  const ignoredFiles = [];
  const fileManifest = [];
  let totalFiles = 0;

  async function walkDirectory(currentDirectory, parentRelativePath = '') {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];

      if (entry.isSymbolicLink()) {
        continue;
      }

      const absoluteEntryPath = path.posix.join(currentDirectory, entry.name);
      const relativePath = parentRelativePath ? `${parentRelativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walkDirectory(absoluteEntryPath, relativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const entryStat = await fs.stat(absoluteEntryPath);
      const size = entryStat.size || 0;

      totalFiles += 1;
      fileManifest.push({
        path: relativePath,
        size,
      });

      if (!relativePath.toLowerCase().endsWith('.dcm')) {
        ignoredFiles.push({
          relativePath,
          size,
          sourceKind: 'mounted-path',
          sourceFilePath: absoluteEntryPath,
        });
        continue;
      }

      dicomFiles.push({
        name: entry.name,
        relativePath,
        size,
        sourceKind: 'mounted-path',
        sourceFilePath: absoluteEntryPath,
      });
    }
  }

  await walkDirectory(rootPath);

  return {
    totalFiles,
    dicomFiles,
    ignoredFiles,
    fileManifest,
  };
}

module.exports = {
  scanSourceDirectory,
};
