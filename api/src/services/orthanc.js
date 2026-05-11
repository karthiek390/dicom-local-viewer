const axios = require('axios');

const orthanc = axios.create({
  baseURL: process.env.ORTHANC_URL || 'http://orthanc:8042',
  timeout: 120000,
});

module.exports = orthanc;

