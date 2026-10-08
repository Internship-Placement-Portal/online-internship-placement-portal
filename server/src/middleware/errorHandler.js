const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const notFound = (req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Resource not found'));

// SAD 4.4: standardized envelope { status, code, message }; stack traces never leave the server.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let { statusCode, code, message, details } = err;

  if (!err.isOperational) {
    if (err.type === 'entity.parse.failed') [statusCode, code, message] = [400, 'INVALID_JSON', 'Malformed JSON body'];
    else if (err.type === 'entity.too.large') [statusCode, code, message] = [413, 'PAYLOAD_TOO_LARGE', 'Request body too large'];
    else if (err.name === 'ValidationError') [statusCode, code, message] = [400, 'VALIDATION_ERROR', 'Invalid input'];
    else if (err.name === 'CastError') [statusCode, code, message] = [400, 'INVALID_ID', 'Invalid identifier'];
    else if (err.code === 11000) [statusCode, code, message] = [409, 'DUPLICATE', 'Resource already exists'];
    else {
      logger.error('Unhandled error', { method: req.method, path: req.originalUrl, error: err.message, stack: err.stack });
      [statusCode, code, message] = [500, 'INTERNAL_ERROR', 'Something went wrong'];
    }
  }

  const body = { status: 'error', code, message };
  if (details) body.errors = details;
  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
