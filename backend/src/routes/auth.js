const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const JWTService = require('../services/jwtService');
const { issueSession } = require('../services/sessionService');
const audit = require('../services/auditService');
const { secrets } = require('../config/secrets');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { validate } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const PasswordService = require('../services/passwordService');
const captchaService = require('../services/captchaService');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { recordAuthFailure } = require('../middleware/ipGuard');
const { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } = require('../utils/cookies');
const { setCsrfCookie, clearCsrfCookie } = require('../middleware/csrf');

// A short-lived token proving "password step passed, MFA still pending".
// It is NOT a session token: purpose='mfa' so the auth middleware rejects it.
function issueMfaChallengeToken(userId) {
  return jwt.sign({ userId, purpose: 'mfa' }, secrets.jwtSecret, { expiresIn: '5m' });
}

// Spec 2.2: after this many failed attempts an account is considered "under
// attack" and must solve a CAPTCHA. Set below the lockout threshold (5) so a
// bot is forced to prove humanity BEFORE it can burn the account's attempts and
// lock out the legitimate owner.
const CAPTCHA_AFTER_FAILURES = 3;

// GET /api/auth/captcha — issue a fresh challenge (image + signed token).
router.get('/captcha', (req, res) => {
  const { token, dataUrl } = captchaService.generate();
  res.status(200).json({ captchaToken: token, image: dataUrl });
});

router.post('/register', registerLimiter, validateRegister, async (req, res) => {
  try {
    const { email, password, role } = req.validatedData;

    // Spec 2.2: registration is always CAPTCHA-gated. Unlike login there is no
    // per-account history to risk-score against, and automated signup is the
    // primary abuse vector (spam accounts, resource exhaustion).
    if (!captchaService.verify(req.body.captchaToken, req.body.captchaAnswer)) {
      audit.log(req, 'captcha.failure', { metadata: { endpoint: 'register' } });
      return res.status(400).json({ error: 'CAPTCHA verification failed', captchaRequired: true });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create(email, password, role);

    return res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.validatedData;

    const user = await User.findByEmail(email);
    if (!user) {
      audit.log(req, 'login.failure', { metadata: { reason: 'unknown_email' } });
      // Feed the IP auto-blocker: guessing usernames is a strong stuffing signal
      // that per-account lockout is blind to (no account exists to lock).
      recordAuthFailure(req);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isLocked = await User.isLocked(user.id);
    if (isLocked) {
      audit.log(req, 'login.locked', { userId: user.id });
      return res.status(403).json({ error: 'Account is locked. Try again in 30 minutes' });
    }

    // Spec 2.2: risk-triggered CAPTCHA. Once an account has accumulated failed
    // attempts it is presumed under automated attack, and further attempts must
    // prove humanity. Checked BEFORE the password comparison so a bot cannot use
    // this endpoint as a password oracle at machine speed.
    if (user.failed_login_attempts >= CAPTCHA_AFTER_FAILURES) {
      if (!captchaService.verify(req.body.captchaToken, req.body.captchaAnswer)) {
        audit.log(req, 'captcha.failure', { userId: user.id, metadata: { endpoint: 'login' } });
        return res.status(400).json({ error: 'CAPTCHA verification required', captchaRequired: true });
      }
    }

    const passwordMatch = await User.verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      await User.incrementFailedAttempts(user.id);
      // Awaited so the current failure is counted by the alert check below.
      await audit.log(req, 'login.failure', { userId: user.id });
      await audit.checkFailedLoginAlert(req, user.id, user.email);
      // Per-IP counter: catches one source spraying MANY accounts, which the
      // per-account lockout cannot detect (each account only fails once or twice).
      recordAuthFailure(req);
      const updatedUser = await User.findById(user.id);
      if (updatedUser.failed_login_attempts >= User.LOCK_THRESHOLD) {
        await User.lockAccount(user.id);
        audit.log(req, 'account.locked', { userId: user.id });
        return res.status(403).json({ error: 'Account locked due to too many failed attempts' });
      }
      // Tell the client when the next attempt will need a CAPTCHA, so it can
      // render one pre-emptively instead of failing the user twice.
      return res.status(401).json({
        error: 'Invalid email or password',
        captchaRequired: updatedUser.failed_login_attempts >= CAPTCHA_AFTER_FAILURES
      });
    }

    await User.resetFailedAttempts(user.id);

    // Password OK. If MFA is enabled, stop here and require a second factor.
    if (user.mfa_enabled) {
      audit.log(req, 'login.mfa_challenge', { userId: user.id });
      return res.status(200).json({ mfaRequired: true, mfaToken: issueMfaChallengeToken(user.id) });
    }

    await User.updateLastLogin(user.id, req.ip || req.connection.remoteAddress);
    await issueSession(req, res, user);
    audit.log(req, 'login.success', { userId: user.id });

    // Spec 3.1: 90-day expiry. We still issue the session — blocking login
    // outright would strand the user with no way to reach the change-password
    // form. Instead the client is told to force a change (and the user cannot
    // dodge it, because must_change_password is also enforced server-side).
    const passwordExpired = PasswordService.isPasswordExpired(user.password_changed_at) || user.must_change_password;

    res.status(200).json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role },
      passwordExpired,
      daysUntilPasswordExpiry: PasswordService.daysUntilExpiry(user.password_changed_at)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Rotate the refresh token: verify → check server-side store → revoke old →
// issue new. Detects reuse of an already-revoked token (theft) and kills the family.
router.post('/refresh', async (req, res) => {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE] || req.body.refreshToken;
    if (!presented) return res.status(401).json({ error: 'No refresh token' });

    const decoded = JWTService.verifyRefreshToken(presented);
    if (!decoded) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await RefreshToken.findById(decoded.jti);

    // Reuse detection: token is valid JWT but its server record is already revoked.
    if (stored && stored.revoked) {
      await RefreshToken.revokeAllForUser(decoded.userId);
      clearAuthCookies(res);
      audit.log(req, 'token.reuse_detected', { userId: decoded.userId });
      return res.status(401).json({ error: 'Refresh token reuse detected. Please sign in again.' });
    }

    if (!RefreshToken.isUsable(stored) || stored.token_hash !== JWTService.hashToken(presented)) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token is no longer valid' });
    }

    // Spec 3.4: session binding. A valid token arriving from a different client
    // than the one it was issued to means it was copied — treat it like theft and
    // kill the whole family, exactly as with reuse detection.
    if (!RefreshToken.matchesBinding(stored, req.headers['user-agent'])) {
      await RefreshToken.revokeAllForUser(decoded.userId);
      clearAuthCookies(res);
      audit.log(req, 'session.binding_mismatch', { userId: decoded.userId });
      return res.status(401).json({ error: 'Session was issued to a different device. Please sign in again.' });
    }

    // IP changes are normal (mobile/NAT/VPN) so they are recorded, not blocked —
    // useful corroborating evidence when investigating an incident.
    if (stored.ip && stored.ip !== req.ip) {
      audit.log(req, 'session.ip_changed', { userId: decoded.userId });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'User not found' });
    }

    // Rotate.
    const accessToken = JWTService.generateAccessToken(user.id, user.role);
    const { token: newRefresh, jti: newJti } = JWTService.generateRefreshToken(user.id);
    await RefreshToken.store({
      jti: newJti,
      userId: user.id,
      tokenHash: JWTService.hashToken(newRefresh),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    await RefreshToken.revoke(decoded.jti, newJti);

    setAuthCookies(res, { accessToken, refreshToken: newRefresh });
    // Re-issue the CSRF token so it never expires before the session does.
    setCsrfCookie(res, secrets.jwtSecret);
    res.status(200).json({ user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/change-password
 * Enforces spec 3.1: reuse prevention (last 5 + current) and re-validates the
 * full strength policy. Requires the current password — so a hijacked session
 * alone cannot lock the real owner out by changing their password.
 */
router.post(
  '/change-password',
  verifyToken,
  requireAuth,
  validate(schemas.changePassword),
  async (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      const user = await User.findById(req.user.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (!(await User.verifyPassword(current_password, user.password_hash))) {
        audit.log(req, 'password.change_failure', { userId: user.id, metadata: { reason: 'bad_current_password' } });
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const strength = PasswordService.validatePasswordStrength(new_password);
      if (!strength.valid) {
        return res.status(400).json({ error: 'Password too weak', details: strength.errors });
      }

      // Reuse check against the current hash + the last 5.
      if (await PasswordService.isPasswordReused(new_password, user.password_hash, user.password_history)) {
        audit.log(req, 'password.change_failure', { userId: user.id, metadata: { reason: 'reuse' } });
        return res
          .status(400)
          .json({ error: `You cannot reuse any of your last ${PasswordService.HISTORY_SIZE} passwords` });
      }

      const newHash = await PasswordService.hashPassword(new_password);
      await User.changePassword(user.id, newHash, user.password_hash, user.password_history);

      // A password change should end every other session (standard practice:
      // if the change was triggered by suspected compromise, the attacker's
      // sessions must die). The current client re-authenticates below.
      await RefreshToken.revokeAllForUser(user.id);
      clearAuthCookies(res);

      audit.log(req, 'password.changed', { userId: user.id });
      return res.status(200).json({ message: 'Password changed. Please sign in again.' });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

router.get('/me', verifyToken, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Real logout: revoke the server-side refresh token and clear cookies.
router.post('/logout', async (req, res) => {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE] || req.body.refreshToken;
    if (presented) {
      const decoded = JWTService.verifyRefreshToken(presented);
      if (decoded?.jti) {
        await RefreshToken.revoke(decoded.jti);
        audit.log(req, 'logout', { userId: decoded.userId });
      }
    }
  } catch (err) {
    /* ignore — always clear cookies below */
  }
  clearAuthCookies(res);
  clearCsrfCookie(res);
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
