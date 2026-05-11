const express = require('express');
const orthanc = require('../services/orthanc');
const asyncHandler = require('../middleware/asyncHandler');
const { accessControl } = require('../middleware/auth');

const router = express.Router();
const isPermittedTo = accessControl('dicom_viewer', 'read');

const ORTHANC_ROOT = process.env.ORTHANC_URL || 'http://orthanc:8042';
const ORTHANC_DICOMWEB_PREFIX = `${ORTHANC_ROOT}/dicom-web`;
const PROXY_DICOMWEB_PREFIX = '/api/dicom-web';

function rewriteOrthancUrls(value) {
  if (Array.isArray(value)) {
    return value.map(rewriteOrthancUrls);
  }

  if (typeof value === 'string') {
    return value.startsWith(ORTHANC_DICOMWEB_PREFIX)
      ? value.replace(ORTHANC_DICOMWEB_PREFIX, PROXY_DICOMWEB_PREFIX)
      : value;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, rewriteOrthancUrls(nestedValue)]),
    );
  }

  return value;
}

async function proxyJson(req, res, orthancPath) {
  const response = await orthanc.get(orthancPath, {
    params: req.query,
    responseType: 'json',
    timeout: 30000,
  });

  res.set('Content-Type', 'application/json');
  res.status(response.status).json(rewriteOrthancUrls(response.data));
}

async function proxyBinary(req, res, orthancPath) {
  const response = await orthanc.get(orthancPath, {
    params: req.query,
    headers: req.headers.accept ? { Accept: req.headers.accept } : {},
    responseType: 'stream',
    timeout: 60000,
  });

  if (response.headers['content-type']) {
    res.set('Content-Type', response.headers['content-type']);
  }

  res.status(response.status);
  response.data.pipe(res);
}

router.get('/studies', isPermittedTo, asyncHandler(async (req, res) => {
  await proxyJson(req, res, '/dicom-web/studies');
}));

router.get('/studies/:studyUID/metadata', isPermittedTo, asyncHandler(async (req, res) => {
  await proxyJson(req, res, `/dicom-web/studies/${req.params.studyUID}/metadata`);
}));

router.get('/studies/:studyUID/series', isPermittedTo, asyncHandler(async (req, res) => {
  await proxyJson(req, res, `/dicom-web/studies/${req.params.studyUID}/series`);
}));

router.get('/studies/:studyUID/series/:seriesUID/metadata', isPermittedTo, asyncHandler(async (req, res) => {
  await proxyJson(
    req,
    res,
    `/dicom-web/studies/${req.params.studyUID}/series/${req.params.seriesUID}/metadata`,
  );
}));

router.get('/studies/:studyUID/series/:seriesUID/instances', isPermittedTo, asyncHandler(async (req, res) => {
  await proxyJson(
    req,
    res,
    `/dicom-web/studies/${req.params.studyUID}/series/${req.params.seriesUID}/instances`,
  );
}));

router.get('/studies/:studyUID/series/:seriesUID/instances/:instanceUID/metadata', isPermittedTo, asyncHandler(async (req, res) => {
  await proxyJson(
    req,
    res,
    `/dicom-web/studies/${req.params.studyUID}/series/${req.params.seriesUID}/instances/${req.params.instanceUID}/metadata`,
  );
}));

router.get('/studies/:studyUID/series/:seriesUID/instances/:instanceUID/frames/:frames', isPermittedTo, asyncHandler(async (req, res) => {
  await proxyBinary(
    req,
    res,
    `/dicom-web/studies/${req.params.studyUID}/series/${req.params.seriesUID}/instances/${req.params.instanceUID}/frames/${req.params.frames}`,
  );
}));

router.get('/studies/:studyUID/series/:seriesUID/instances/:instanceUID', isPermittedTo, asyncHandler(async (req, res) => {
  await proxyBinary(
    req,
    res,
    `/dicom-web/studies/${req.params.studyUID}/series/${req.params.seriesUID}/instances/${req.params.instanceUID}`,
  );
}));

module.exports = router;

