const express = require('express');
const cors = require('cors');

const { attachLocalUser } = require('./middleware/auth');
const datasetRegistryRoutes = require('./routes/datasetRegistry');
const dicomRoutes = require('./routes/dicom');
const viewerRoutes = require('./routes/viewer');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(attachLocalUser);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/viewer', viewerRoutes);
app.use('/api/dataset-registry', datasetRegistryRoutes);
app.use('/api/dicom-web', dicomRoutes);

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error(err);
  res.status(status).json({
    error: err.message || 'Unexpected error',
  });
});

module.exports = app;
