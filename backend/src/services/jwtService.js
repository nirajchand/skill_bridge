const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { secrets } = require('../config/secrets');

// Secrets are validated at startup by config/secrets.js — no hardcoded fallbacks.
class JWTService {
  static generateAccessToken(userId, role) {
    return jwt.sign({ userId, role }, secrets.jwtSecret, { expiresIn: '15m' });
  }

  // Refresh tokens carry a unique jti so each one can be tracked/revoked server-side.
  static generateRefreshToken(userId, jti = crypto.randomUUID()) {
    const token = jwt.sign({ userId, jti }, secrets.jwtRefreshSecret, { expiresIn: '7d' });
    return { token, jti };
  }

  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, secrets.jwtSecret);
    } catch (err) {
      return null;
    }
  }

  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, secrets.jwtRefreshSecret);
    } catch (err) {
      return null;
    }
  }

  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

module.exports = JWTService;
