const app = require('./app');

const port = Number(process.env.PORT || 3030);

app.listen(port, () => {
  console.log(`dicom-local-viewer api listening on ${port}`);
});

