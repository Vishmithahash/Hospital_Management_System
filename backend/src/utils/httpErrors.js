function createError(status, message, details) {
  const error = new Error(message);
  error.status = status;

  if (details) {
    error.details = details;
  }

  return error;
}

function badRequest(message = 'Bad Request', details) {
  return createError(400, message, details);
}

function forbidden(message = 'Forbidden') {
  return createError(403, message);
}

function notFound(message = 'Not Found') {
  return createError(404, message);
}

function conflict(message = 'Conflict', details) {
  return createError(409, message, details);
}

function serverError(message = 'Internal Server Error') {
  return createError(500, message);
}

module.exports = {
  badRequest,
  forbidden,
  notFound,
  conflict,
  serverError
};
