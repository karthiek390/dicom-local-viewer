function resolveSessionFilePath(file) {
  if (file?.storedPath) {
    return file.storedPath;
  }

  if (file?.sourceFilePath) {
    return file.sourceFilePath;
  }

  throw new Error('Session file does not have a readable source path');
}

module.exports = {
  resolveSessionFilePath,
};
