/**
 * Centralised error handler — the last line of defence against information
 * disclosure (OWASP A05: Security Misconfiguration).
 *
 * Rules:
 *  1. The full error (message + stack) is logged SERVER-SIDE only.
 *  2. The client receives a generic message and never a stack trace, SQL string,
 *     file path, or driver internal — those hand an attacker a map of the system.
 *  3. An error may only carry a client-safe message if it is explicitly marked
 *     `expose = true` (or is a 4xx we raised deliberately). We never infer intent
 *     by string-matching err.message, which is brittle and leaks by accident.
 */

// Raise this for errors whose message is safe to show the user.
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

const GENERIC = {
  400: 'Invalid request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  413: 'Payload too large',
  415: 'Unsupported media type',
  429: 'Too many requests',
  500: 'Internal server error'
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;

  // Full detail stays on the server (stack included) for debugging/incident response.
  console.error(`[error] ${req.method} ${req.originalUrl} -> ${status}:`, err.message, '\n', err.stack);

  // Only explicitly-exposed errors may reveal their message; everything else
  // (especially 5xx) falls back to a generic string.
  const safeMessage = err.expose === true && status < 500 ? err.message : GENERIC[status] || GENERIC[500];

  res.status(status).json({ success: false, data: null, error: safeMessage });
}

module.exports = { errorHandler, AppError };
