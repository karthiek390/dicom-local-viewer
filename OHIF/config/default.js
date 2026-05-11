/** @type {AppTypes.Config} */
window.config = {
  name: 'config/default.js',
  routerBasename: '/ohif',
  extensions: [],
  modes: ['@ohif/mode-basic-dev-mode'],
  showStudyList: true,
  maxNumberOfWebWorkers: 3,
  showLoadingIndicator: true,
  defaultDataSourceName: 'orthanc',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'orthanc',
      configuration: {
        friendlyName: 'Local DICOM Proxy',
        name: 'Orthanc',
        wadoUriRoot: '/api/dicom-web',
        qidoRoot: '/api/dicom-web',
        wadoRoot: '/api/dicom-web',
        qidoSupportsIncludeField: true,
        supportsReject: false,
        dicomUploadEnabled: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: true,
        omitQuotationForMultipartRequest: true,
        bulkDataURI: { enabled: true, relativeResolution: 'studies' }
      }
    }
  ]
};

