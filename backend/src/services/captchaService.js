const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { secrets } = require('../config/secrets');

/**
 * Self-contained CAPTCHA (coursework spec 2.2).
 *
 * Design decisions:
 *  - Built in-house rather than reCAPTCHA/hCaptcha because those require a
 *    third-party account, ship tracking scripts to every visitor (a privacy and
 *    supply-chain consideration under spec 2.4), and would add an external origin
 *    to our CSP. This keeps the trust boundary inside our own server.
 *  - STATELESS: the answer is never stored server-side. Instead it is hashed into
 *    a short-lived signed JWT that the client echoes back. No session store, no
 *    DB row, nothing to clean up, and it works across multiple server instances.
 *  - The token carries only a SHA-256 of the answer, so intercepting the token
 *    does not reveal the code, and the signature stops anyone forging a "solved"
 *    token.
 *  - RISK-TRIGGERED on login (see routes/auth.js): showing a CAPTCHA to every
 *    user on every login is hostile and trains people to hate the product; it is
 *    only demanded once an account shows signs of being attacked.
 */

// Ambiguous glyphs (0/O, 1/l/I) are excluded so humans aren't failed unfairly.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const TTL_SECONDS = 300; // 5 minutes: long enough to type, short enough to limit replay

function randomCode() {
  let code = '';
  const bytes = crypto.randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

function hashAnswer(answer) {
  return crypto.createHash('sha256').update(String(answer).trim().toUpperCase()).digest('hex');
}

const rand = (min, max) => min + Math.random() * (max - min);

/**
 * Render the code as an SVG. Distortion (per-character rotation, jitter, varying
 * colour, plus noise lines) is what makes naive OCR harder — a plain string in an
 * <image> would be trivially readable by a bot.
 */
function renderSvg(code) {
  const width = 160;
  const height = 50;
  let parts = '';

  // Noise lines drawn behind the text. Mid-tone greens/greys so they obscure the
  // glyphs from OCR without dropping below the contrast a human needs.
  for (let i = 0; i < 5; i++) {
    parts += `<line x1="${rand(0, width).toFixed(1)}" y1="${rand(0, height).toFixed(1)}" x2="${rand(0, width).toFixed(
      1
    )}" y2="${rand(0, height).toFixed(1)}" stroke="hsl(${rand(140, 175).toFixed(0)},45%,55%)" stroke-width="1" opacity="0.45"/>`;
  }

  code.split('').forEach((char, i) => {
    const x = 18 + i * 27 + rand(-3, 3);
    const y = 34 + rand(-4, 4);
    const rot = rand(-28, 28).toFixed(1);
    // Dark green glyphs: the theme is green-on-white, so the code must be DARK on
    // a light plate. (It was previously light text on a near-black plate, which
    // would be an unreadable dark rectangle on the new UI.)
    const hue = rand(140, 175).toFixed(0);
    parts += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="monospace" font-size="${rand(24, 30).toFixed(
      0
    )}" font-weight="bold" fill="hsl(${hue},60%,${rand(24, 36).toFixed(0)}%)" transform="rotate(${rot} ${x.toFixed(
      1
    )} ${y.toFixed(1)})">${char}</text>`;
  });

  // Noise dots in front.
  for (let i = 0; i < 25; i++) {
    parts += `<circle cx="${rand(0, width).toFixed(1)}" cy="${rand(0, height).toFixed(1)}" r="${rand(0.5, 1.6).toFixed(
      1
    )}" fill="hsl(${rand(140, 175).toFixed(0)},45%,45%)" opacity="0.45"/>`;
  }

  // Light plate to match the green/white theme.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f5f5f5"/>${parts}</svg>`;
}

// Returns the image plus a signed token binding that image to its answer.
function generate() {
  const code = randomCode();
  const token = jwt.sign({ h: hashAnswer(code), purpose: 'captcha' }, secrets.jwtSecret, {
    expiresIn: TTL_SECONDS
  });
  // Render ONCE: renderSvg() is randomised, so calling it twice would produce two
  // different images and the base64 copy would not match the inline one.
  const svg = renderSvg(code);
  return { token, svg, dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
}

/**
 * Verify an answer against its token. Returns true only if the token is
 * authentic, unexpired, actually a captcha token, and the answer matches.
 * Case-insensitive because case is not a security property here — it only adds
 * user frustration.
 */
function verify(token, answer) {
  if (!token || !answer) return false;
  try {
    const payload = jwt.verify(token, secrets.jwtSecret);
    if (payload.purpose !== 'captcha') return false;
    // timingSafeEqual over the hex digests: both are fixed 64-char strings.
    const a = Buffer.from(payload.h, 'utf8');
    const b = Buffer.from(hashAnswer(answer), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false; // expired or tampered
  }
}

module.exports = { generate, verify, CODE_LENGTH };
