const rateLimit = require('express-rate-limit');

/**
 * Rate limiting (coursework spec 3.2).
 *
 * All limiters answer in the SAME `{ success, data, error }` envelope the rest of
 * the API uses. This matters: the default express-rate-limit response is
 * plain text, so the frontend's error parser found no `.error` field and fell
 * back to a generic "Login failed" — telling the user their credentials were
 * wrong when they were actually throttled. A security control that lies to the
 * user costs support time and trains people to distrust real messages.
 *
 * `retryAfter` is included so the UI can say "try again in N seconds" rather than
 * leaving people to guess.
 */
function limitHandler(message) {
  return (req, res) => {
    const retryAfterSec = Math.ceil((req.rateLimit?.resetTime?.getTime() - Date.now()) / 1000) || undefined;
    res.status(429).json({
      success: false,
      data: null,
      error: message,
      retryAfter: retryAfterSec && retryAfterSec > 0 ? retryAfterSec : undefined
    });
  };
}

const common = { standardHeaders: true, legacyHeaders: false };

// Humans mistype 2-3 times; 10/min leaves headroom while cutting a naive
// brute-force from thousands of guesses per minute to ten.
const loginLimiter = rateLimit({
  ...common,
  windowMs: 1 * 60 * 1000,
  max: 10,
  handler: limitHandler('Too many login attempts. Please wait a minute and try again.')
});

// Signup is rare and expensive (row insert + bcrypt). 5/hour stops mass fake
// account creation without ever affecting a real person.
const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  max: 5,
  handler: limitHandler('Too many registration attempts. Please try again later.')
});

// Roughly an order of magnitude above normal dashboard browsing, so it only
// catches scraping/automation.
const apiLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  max: 100,
  // Auth endpoints have their own tighter limiters above. Excluding them here
  // stops a burst of ordinary API traffic (dashboard polling, dev testing) from
  // locking a legitimate user out of *signing in* — being unable to log in is a
  // far worse failure than being throttled on a data endpoint.
  skip: (req) => req.path.startsWith('/auth/'),
  handler: limitHandler('Too many requests. Please slow down and try again shortly.')
});

module.exports = {
  loginLimiter,
  registerLimiter,
  apiLimiter
};
