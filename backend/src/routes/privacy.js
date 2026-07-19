const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const User = require('../models/User');
const profileService = require('../services/profileService');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const audit = require('../services/auditService');
const { ok, fail } = require('../utils/http');

/**
 * Data portability & erasure (coursework spec 2.3).
 *
 * Implements the rights that privacy regimes (GDPR Arts. 15/17/20, and Nepal's
 * Individual Privacy Act 2075 / Electronic Transactions Act 2063 principles)
 * expect: a user can obtain a machine-readable copy of their data, re-import it,
 * and request deletion.
 *
 * Security notes:
 *  - Export returns ONLY the requester's own data (req.user.userId), never an
 *    id from the URL — so it cannot be turned into an IDOR to dump other users.
 *  - Secrets are excluded from the export: password hashes, MFA secrets and
 *    backup codes, and refresh-token hashes. An export file is emailed around
 *    and stored in Downloads; putting credential material in it would turn a
 *    privacy feature into a credential-leak vector.
 *  - Every export/deletion is audited — bulk self-exports are a data-exfiltration
 *    signal worth being able to investigate.
 */

// GET /api/privacy/export — machine-readable copy of everything we hold.
router.get('/export', verifyToken, requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) return fail(res, 'User not found', 404);

    const [tasks, applications, contracts, disputes, payments, payouts, logins] = await Promise.all([
      db('tasks').where({ client_id: userId }).whereNull('deleted_at'),
      db('applications').where({ freelancer_id: userId }),
      db('contracts').where({ client_id: userId }).orWhere({ freelancer_id: userId }),
      db('disputes').where({ raised_by: userId }),
      db('payments').where({ payer_id: userId }).orWhere({ payee_id: userId }),
      db('payouts').where({ freelancer_id: userId }),
      db('audit_logs').where({ user_id: userId }).orderBy('created_at', 'desc').limit(200)
    ]);

    const payload = {
      export_metadata: {
        generated_at: new Date().toISOString(),
        format_version: 1,
        notice:
          'Credential material (password hash, MFA secret, backup codes, session tokens) is deliberately excluded for your safety.'
      },
      // profileService.privateProfile() already whitelists safe fields and
      // decrypts what belongs to the owner.
      account: {
        ...profileService.privateProfile(user),
        last_login_at: user.last_login_at,
        last_login_ip: User.readLastLoginIp(user), // decrypted for its owner only
        created_at: user.created_at
      },
      tasks,
      applications,
      contracts,
      disputes,
      payments,
      payouts,
      recent_activity: logins.map((l) => ({ event: l.event, at: l.created_at, ip: l.ip }))
    };

    audit.log(req, 'privacy.data_exported', { userId, metadata: { records: tasks.length + contracts.length } });

    // Content-Disposition makes the browser save it rather than render it —
    // and X-Content-Type-Options: nosniff (set globally) stops the JSON being
    // re-interpreted as HTML if it ever contained markup.
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="skillbridge-export-${userId}.json"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Data export error:', err);
    return fail(res, 'Failed to export data', 500);
  }
});

// POST /api/privacy/import — restore profile fields from a previous export.
router.post('/import', verifyToken, requireAuth, validate(schemas.privacyImport), async (req, res) => {
  try {
    const account = req.body.account;

    /**
     * Import is deliberately LIMITED to profile fields.
     *
     * It would be a critical vulnerability to trust an uploaded file for
     * anything else: the file is fully attacker-controlled, so importing
     * `role`, `contracts`, `payments` or `is_verified` would let anyone grant
     * themselves admin or fabricate money records simply by editing JSON.
     * We therefore re-validate with the same Joi schema used by the normal
     * profile editor and write through User.updateProfile(), whose allowlist
     * blocks mass assignment.
     */
    const updates = {};
    if (account.display_name !== undefined) updates.display_name = account.display_name;
    if (account.bio !== undefined) updates.bio = account.bio || null;
    if (account.location !== undefined) updates.location = account.location || null;
    if (account.skills !== undefined) updates.skills = JSON.stringify(account.skills || []);
    if (account.hourly_rate !== undefined) updates.hourly_rate = account.hourly_rate || null;
    if (account.portfolio_url !== undefined) updates.portfolio_url = account.portfolio_url || null;
    if (account.company_name !== undefined) updates.company_name = account.company_name || null;
    if (account.company_website !== undefined) updates.company_website = account.company_website || null;

    if (Object.keys(updates).length === 0) return fail(res, 'Nothing importable found in that file');

    const updated = await User.updateProfile(req.user.userId, updates);
    const pct = profileService.calcCompletion(updated);
    const final = await User.updateProfile(req.user.userId, {
      profile_completion_percentage: pct,
      profile_completed: pct >= 100
    });

    audit.log(req, 'privacy.data_imported', { userId: req.user.userId, metadata: { fields: Object.keys(updates) } });
    return ok(res, profileService.privateProfile(final));
  } catch (err) {
    console.error('Data import error:', err);
    return fail(res, 'Failed to import data', 500);
  }
});

// DELETE /api/privacy/account — right to erasure.
router.delete('/account', verifyToken, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return fail(res, 'User not found', 404);

    // Require the password: deletion is irreversible, so a hijacked session
    // alone must not be able to destroy an account.
    const { password } = req.body;
    if (!password || !(await User.verifyPassword(password, user.password_hash))) {
      return fail(res, 'Password confirmation required to delete your account', 401);
    }

    /**
     * Money records are NOT deleted. Financial/audit records must be retained
     * for accounting and dispute obligations — the legal basis for keeping them
     * survives an erasure request. Instead the account is ANONYMISED: personal
     * data is destroyed while the ledger stays balanced and referentially intact.
     */
    const anonId = `deleted-${user.id.slice(0, 8)}@deleted.invalid`;
    await db.transaction(async (trx) => {
      await trx('users').where({ id: user.id }).update({
        email: anonId,
        display_name: 'Deleted user',
        bio: null,
        location: null,
        skills: null,
        profile_image_url: null,
        cv_url: null,
        portfolio_url: null,
        company_name: null,
        company_website: null,
        last_login_ip: null,
        mfa_secret: null,
        mfa_enabled: false,
        mfa_backup_codes: null,
        password_history: null,
        // Random unusable password: the account can never be logged into again.
        password_hash: await User.hashPassword(require('crypto').randomBytes(32).toString('hex'))
      });
      // Kill every session immediately.
      await trx('refresh_tokens').where({ user_id: user.id }).update({ revoked: true });
    });

    audit.log(req, 'privacy.account_deleted', { userId: user.id });
    return ok(res, { message: 'Your account has been deleted and your personal data erased.' });
  } catch (err) {
    console.error('Account deletion error:', err);
    return fail(res, 'Failed to delete account', 500);
  }
});

module.exports = router;
