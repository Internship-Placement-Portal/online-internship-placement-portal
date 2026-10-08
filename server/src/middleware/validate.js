const AppError = require('../utils/AppError');

// Validates and replaces req[source] with the Joi-cleaned value (unknown keys stripped).
module.exports = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid input', details));
  }
  req[source] = value;
  next();
};
