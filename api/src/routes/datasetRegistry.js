const express = require('express');
const createError = require('http-errors');

const asyncHandler = require('../middleware/asyncHandler');
const { accessControl } = require('../middleware/auth');
const {
  listDatasetRegistry,
  getDatasetRegistryWorkspaceSummary,
  getDatasetById,
  createDatasetRecord,
  updateDatasetRecord,
  deleteDatasetRecord,
  reconcileDatasetSessionStatuses,
} = require('../utils/datasetRegistryStore');
const { hasAnalysisSession } = require('../utils/analysisSessionStore');

const router = express.Router();

router.get(
  '/',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const payload = await listDatasetRegistry({
      search: req.query.search,
      sort: req.query.sort,
      status: req.query.status,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    res.json(payload);
  }),
);

router.get(
  '/summary',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (_req, res) => {
    const payload = await getDatasetRegistryWorkspaceSummary();
    res.json(payload);
  }),
);

router.get(
  '/:datasetId',
  accessControl('dicom_viewer', 'read'),
  asyncHandler(async (req, res) => {
    const dataset = await getDatasetById(String(req.params.datasetId));
    if (!dataset) {
      throw createError.NotFound('Dataset registry entry not found');
    }

    res.json(dataset);
  }),
);

router.post(
  '/reconcile-sessions',
  accessControl('dicom_viewer', 'update'),
  asyncHandler(async (req, res) => {
    const datasetId = req.body?.datasetId ? String(req.body.datasetId) : '';
    const payload = await reconcileDatasetSessionStatuses(hasAnalysisSession, {
      datasetId,
    });

    res.json({
      version: payload.version,
      updatedAt: payload.updatedAt,
      reconciledDatasetId: datasetId || null,
    });
  }),
);

router.post(
  '/',
  accessControl('dicom_viewer', 'create'),
  asyncHandler(async (req, res) => {
    const dataset = await createDatasetRecord(req.body || {});
    res.status(201).json(dataset);
  }),
);

router.patch(
  '/:datasetId',
  accessControl('dicom_viewer', 'update'),
  asyncHandler(async (req, res) => {
    const dataset = await updateDatasetRecord(String(req.params.datasetId), req.body || {});
    if (!dataset) {
      throw createError.NotFound('Dataset registry entry not found');
    }

    res.json(dataset);
  }),
);

router.delete(
  '/:datasetId',
  accessControl('dicom_viewer', 'delete'),
  asyncHandler(async (req, res) => {
    const dataset = await deleteDatasetRecord(String(req.params.datasetId));
    if (!dataset) {
      throw createError.NotFound('Dataset registry entry not found');
    }

    res.json({
      deleted: true,
      datasetId: dataset.id,
    });
  }),
);

module.exports = router;
