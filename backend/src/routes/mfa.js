const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const mfaService = require('../services/mfaService');
const crypto = require('../services/cryptoService');
const { issueSession } = require('../services/sessionService');
const audit = require('../services/auditService');
const { secrets } = require('../config/secrets');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const { ok, fail } = require('../utils/http');

// GET /api/auth/mfa/status
router.get('/status', verifyToken, requireAuth, async (req, res) => {
  const user = await User.findById(req.user.userId);
  return ok(res, { enabled: !!user?.mfa_enabled });
});

// POST /api/auth/mfa/setup — generate a secret + QR (not yet enabled)
router.post('/setup', verifyToken, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.mfa_enabled) return fail(res, 'MFA is already enabled');

    const { base32, qrDataUrl } = await mfaService.generateSecret(user.email);
    // Store the secret ENCRYPTED; enabling is confirmed in a second step.
    await User.setMfaSecret(user.id, crypto.encrypt(base32));
    return ok(res, { qr: qrDataUrl, secret: base32 });
  } catch (err) {
    console.error('MFA setup error:', err);
    return fail(res, 'Failed to start MFA setup', 500);
  }
});

// POST /api/auth/mfa/enable — confirm a code, turn MFA on, return backup codes ONCE
router.post('/enable', verifyToken, requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.userId);
    if (user.mfa_enabled) return fail(res, 'MFA is already enabled');
    if (!user.mfa_secret) return fail(res, 'Start MFA setup first');

    const base32 = crypto.decrypt(user.mfa_secret);
    if (!mfaService.verifyToken(base32, token)) return fail(res, 'Invalid code. Try again.');

    const { plain, hashed } = await mfaService.generateBackupCodes();
    await User.enableMfa(user.id, JSON.stringify(hashed));
    audit.log(req, 'mfa.enabled', { userId: user.id });
    // Backup codes are shown exactly once here.
    return ok(res, { enabled: true, backupCodes: plain });
  } catch (err) {
    console.error('MFA enable error:', err);
    return fail(res, 'Failed to enable MFA', 500);
  }
});

// POST /api/auth/mfa/disable — requires a valid current code
router.post('/disable', verifyToken, requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user.mfa_enabled) return fail(res, 'MFA is not enabled');

    const base32 = crypto.decrypt(user.mfa_secret);
    if (!mfaService.verifyToken(base32, token)) return fail(res, 'Invalid code');

    await User.disableMfa(user.id);
    audit.log(req, 'mfa.disabled', { userId: user.id });
    return ok(res, { enabled: false });
  } catch (err) {
    console.error('MFA disable error:', err);
    return fail(res, 'Failed to disable MFA', 500);
  }
});

// POST /api/auth/mfa/verify-login — second factor after password step
router.post('/verify-login', loginLimiter, async (req, res) => {
  try {
    const { mfaToken, code, isBackupCode } = req.body;
    if (!mfaToken || !code) return fail(res, 'Missing MFA token or code', 400);

    let payload;
    try {
      payload = jwt.verify(mfaToken, secrets.jwtSecret);
    } catch {
      return fail(res, 'MFA session expired. Please sign in again.', 401);
    }
    if (payload.purpose !== 'mfa') return fail(res, 'Invalid MFA token', 401);

    const user = await User.findById(payload.userId);
    if (!user || !user.mfa_enabled) return fail(res, 'MFA not enabled', 400);

    let verified = false;
    if (isBackupCode) {
      const hashed = user.mfa_backup_codes ? JSON.parse(user.mfa_backup_codes) : [];
      const remaining = await mfaService.consumeBackupCode(code, hashed);
      if (remaining) {
        verified = true;
        await User.updateBackupCodes(user.id, JSON.stringify(remaining));
      }
    } else {
      verified = mfaService.verifyToken(crypto.decrypt(user.mfa_secret), code);
    }

    if (!verified) {
      audit.log(req, 'mfa.verify_failure', { userId: user.id, metadata: { backup: !!isBackupCode } });
      return fail(res, 'Invalid code', 401);
    }

    await User.updateLastLogin(user.id, req.ip || req.connection.remoteAddress);
    await issueSession(req, res, user);
    audit.log(req, 'login.success', { userId: user.id, metadata: { mfa: true, backup: !!isBackupCode } });
    return ok(res, { user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('MFA verify-login error:', err);
    return fail(res, 'MFA verification failed', 500);
  }
});

module.exports = router;
