const { ZodError } = require('zod');

function formatFieldErrors(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }));
}

function validate(schema, target = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[target]);
      req[`validated${target.charAt(0).toUpperCase()}${target.slice(1)}`] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fieldErrors: formatFieldErrors(error)
        });
        return;
      }

      next(error);
    }
  };
}

module.exports = validate;
