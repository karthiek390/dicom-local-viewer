const AccessControl = require('accesscontrol');
const createError = require('http-errors');

const ac = new AccessControl();

ac.grant('viewer')
  .readAny('dicom_viewer');

ac.grant('editor')
  .extend('viewer')
  .createAny('dicom_viewer')
  .updateAny('dicom_viewer');

ac.grant('admin')
  .extend('editor')
  .deleteAny('dicom_viewer');

function attachLocalUser(req, _res, next) {
  req.user = {
    id: 'local-user',
    username: process.env.LOCAL_USER_NAME || 'local-user',
    roles: [process.env.LOCAL_USER_ROLE || 'admin'],
  };
  next();
}

function buildAction(action) {
  const lookup = {
    create: 'createAny',
    read: 'readAny',
    update: 'updateAny',
    delete: 'deleteAny',
  };

  return lookup[action];
}

function accessControl(resource, action) {
  return function wrappedAccessControl(req, _res, next) {
    const roles = req.user?.roles || [];
    const method = buildAction(action);

    const granted = roles.some((role) => ac.can(role)[method](resource).granted);
    if (!granted) {
      return next(createError.Forbidden('Not permitted'));
    }

    return next();
  };
}

module.exports = {
  attachLocalUser,
  accessControl,
};

