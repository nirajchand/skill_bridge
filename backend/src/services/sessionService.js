const JWTService = require('./jwtService');
const RefreshToken = require('../models/RefreshToken');
const { setAuthCookies } = require('../utils/cookies');
const { setCsrfCookie } = require('../middleware/csrf');
const { secrets } = require('../config/secrets');

// Issue an access token + a rotating refresh token, persist the refresh token
// server-side (so it can be revoked), and set them as httpOnly cookies.
// A CSRF token is issued alongside, since it is only meaningful once a session
// cookie exists for an attacker to try to ride.
async function issueSession(req, res, user) {
  const accessToken = JWTService.generateAccessToken(user.id, user.role);
  const { token: refreshToken, jti } = JWTService.generateRefreshToken(user.id);
  await RefreshToken.store({
    jti,
    userId: user.id,
    tokenHash: JWTService.hashToken(refreshToken),
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  setAuthCookies(res, { accessToken, refreshToken });
  setCsrfCookie(res, secrets.jwtSecret);
}

module.exports = { issueSession };
