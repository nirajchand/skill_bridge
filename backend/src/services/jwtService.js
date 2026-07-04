const jwt = require('jsonwebtoken');

class JWTService {
  static generateAccessToken(userId, role) {
    return jwt.sign(
      { userId, role },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '15m' }
    );
  }

  static generateRefreshToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'dev-refresh-secret-change-in-production',
      { expiresIn: '7d' }
    );
  }

  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-in-production');
    } catch (err) {
      return null;
    }
  }

  static verifyRefreshToken(token) {
    try {
      return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'dev-refresh-secret-change-in-production'
      );
    } catch (err) {
      return null;
    }
  }
}

module.exports = JWTService;
