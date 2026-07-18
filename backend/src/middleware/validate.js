const { fail } = require('../utils/http');

/**
 * Generic Joi validation middleware. On success it REPLACES req[source] with the
 * validated value and `stripUnknown: true` drops any properties not in the schema
 * — this both standardizes validation and provides defense-in-depth against mass
 * assignment (unexpected fields never reach handlers/models).
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: true, stripUnknown: true, convert: true });
    if (error) return fail(res, error.details[0].message, 400);
    req[source] = value;
    next();
  };
}

module.exports = { validate };
