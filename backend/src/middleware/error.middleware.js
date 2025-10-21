const { randomUUID } = require('crypto');
const { ZodError } = require('zod');
const logger = require('../utils/logger');

function toFieldErrors(zodError) {
  return zodError.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }));
}

function errorMiddleware(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const correlationId = randomUUID();

  const payload = {
    code: err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
    message: err.message || 'Unexpected error occurred',
    correlationId
  };

  if (err.details) {
    payload.details = err.details;
  }

  if (err instanceof ZodError) {
    payload.code = 'VALIDATION_ERROR';
    payload.message = 'Request validation failed';
    payload.fieldErrors = toFieldErrors(err);
  } else if (err.fieldErrors) {
    payload.fieldErrors = err.fieldErrors;
  }

  if (status >= 500) {
    logger.error('Unhandled application error', { correlationId, error: err });
  } else {
    logger.warn('Handled application error', { correlationId, error: err });
  }

  res.status(status).json(payload);
}

module.exports = errorMiddleware;
