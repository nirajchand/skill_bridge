function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  let status = 500;
  let message = 'Internal server error';

  if (err.message.includes('Unauthorized')) {
    status = 401;
    message = 'Unauthorized';
  }

  if (err.message.includes('Forbidden')) {
    status = 403;
    message = 'Forbidden';
  }

  if (err.message.includes('Not found')) {
    status = 404;
    message = 'Not found';
  }

  res.status(status).json({
    error: message,
    status,
  });
}

module.exports = { errorHandler };
