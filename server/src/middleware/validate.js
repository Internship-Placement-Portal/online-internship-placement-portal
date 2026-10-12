const AppError = require('../utils/AppError');

// Validates and replaces req[source] with the Joi-cleaned value (unknown keys stripped).
module.exports = (schema, source = 'body') => (req, res, next) => {
  // `?q=&domain=` (an untouched filter form) means "no filter", not an invalid value.
  if (source === 'query') {
    Object.keys(req.query).forEach((k) => {
      if (req.query[k] === '') delete req.query[k];
    });
  }
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid input', details));
  }
  req[source] = value;
  next();
};
