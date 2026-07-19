const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../db/connection');
const User = require('../models/User');
const profileService = require('../services/profileService');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { uploadImage, uploadCv, UPLOAD_DIR } = require('../middleware/upload');
const { validate } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const { checkUserSuppliedUrl } = require('../utils/ssrfGuard');
const { ok, fail } = require('../utils/http');

function fileUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

function deleteLocalFile(url) {
  if (!url) return;
  const filename = url.split('/uploads/')[1];
  if (!filename) return;
  const filePath = path.join(UPLOAD_DIR, path.basename(filename));
  fs.promises.unlink(filePath).catch(() => {});
}

// GET /api/users/me/profile — full private profile
router.get('/me/profile', verifyToken, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return fail(res, 'User not found', 404);
    const completed = await User.completedContractsCount(user.id, user.role);
    return ok(res, profileService.privateProfile(user, { completed_contracts: completed }));
  } catch (err) {
    console.error('Get my profile error:', err);
    return fail(res, 'Failed to load profile', 500);
  }
});

// PATCH /api/users/me/profile — update profile fields
router.patch('/me/profile', verifyToken, requireAuth, validate(schemas.updateProfile), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return fail(res, 'User not found', 404);

    // req.body is Joi-validated and stripped of unknown keys.
    const body = req.body;

    // SSRF defence-in-depth: Joi proves these are syntactically valid http(s)
    // URLs, but not WHERE they point. Reject links aimed at internal hosts or the
    // cloud metadata endpoint before they are stored — otherwise they sit in the
    // DB waiting for an admin to click them, or for any future server-side
    // fetch/preview feature to turn them into a live SSRF.
    for (const field of ['portfolio_url', 'company_website']) {
      if (body[field]) {
        // eslint-disable-next-line no-await-in-loop
        const check = await checkUserSuppliedUrl(body[field]);
        if (!check.safe) return fail(res, `${field.replace('_', ' ')}: ${check.reason}`);
      }
    }

    const updates = {};
    if ('display_name' in body) updates.display_name = body.display_name.trim();
    if ('bio' in body) updates.bio = (body.bio || '').trim() || null;
    if ('location' in body) updates.location = (body.location || '').trim() || null;
    if ('skills' in body) updates.skills = JSON.stringify((body.skills || []).map((s) => s.trim()).filter(Boolean));
    if ('hourly_rate' in body) updates.hourly_rate = body.hourly_rate === '' || body.hourly_rate == null ? null : body.hourly_rate;
    if ('portfolio_url' in body) updates.portfolio_url = body.portfolio_url || null;
    if ('company_website' in body) updates.company_website = body.company_website || null;
    if ('company_name' in body) updates.company_name = (body.company_name || '').trim() || null;

    const updatedRow = await User.updateProfile(req.user.userId, updates);
    const pct = profileService.calcCompletion(updatedRow);
    const finalRow = await User.updateProfile(req.user.userId, {
      profile_completion_percentage: pct,
      profile_completed: pct >= 100
    });

    const completed = await User.completedContractsCount(finalRow.id, finalRow.role);
    return ok(res, profileService.privateProfile(finalRow, { completed_contracts: completed }));
  } catch (err) {
    console.error('Update profile error:', err);
    return fail(res, 'Failed to update profile', 500);
  }
});

// POST /api/users/me/profile/upload-image
router.post('/me/profile/upload-image', verifyToken, requireAuth, uploadImage, async (req, res) => {
  try {
    if (!req.file) return fail(res, 'No file uploaded');
    const user = await User.findById(req.user.userId);
    deleteLocalFile(user.profile_image_url);

    const url = fileUrl(req, req.file.filename);
    const updated = await User.updateProfile(req.user.userId, { profile_image_url: url });
    const pct = profileService.calcCompletion(updated);
    await User.updateProfile(req.user.userId, { profile_completion_percentage: pct, profile_completed: pct >= 100 });
    return ok(res, { avatar_url: url, message: 'Image uploaded' });
  } catch (err) {
    console.error('Upload image error:', err);
    return fail(res, 'Failed to upload image', 500);
  }
});

// POST /api/users/me/profile/upload-cv (freelancer only)
router.post('/me/profile/upload-cv', verifyToken, requireAuth, requireRole(['freelancer']), uploadCv, async (req, res) => {
  try {
    if (!req.file) return fail(res, 'No file uploaded');
    const user = await User.findById(req.user.userId);
    deleteLocalFile(user.cv_url);

    const url = fileUrl(req, req.file.filename);
    const updated = await User.updateProfile(req.user.userId, { cv_url: url });
    const pct = profileService.calcCompletion(updated);
    await User.updateProfile(req.user.userId, { profile_completion_percentage: pct, profile_completed: pct >= 100 });
    return ok(res, { cv_url: url, message: 'CV uploaded' });
  } catch (err) {
    console.error('Upload CV error:', err);
    return fail(res, 'Failed to upload CV', 500);
  }
});

// DELETE /api/users/me/profile/image
router.delete('/me/profile/image', verifyToken, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    deleteLocalFile(user.profile_image_url);
    await User.updateProfile(req.user.userId, { profile_image_url: null });
    return ok(res, { message: 'Image removed' });
  } catch (err) {
    console.error('Delete image error:', err);
    return fail(res, 'Failed to remove image', 500);
  }
});

// DELETE /api/users/me/profile/cv (freelancer only)
router.delete('/me/profile/cv', verifyToken, requireAuth, requireRole(['freelancer']), async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    deleteLocalFile(user.cv_url);
    await User.updateProfile(req.user.userId, { cv_url: null });
    return ok(res, { message: 'CV removed' });
  } catch (err) {
    console.error('Delete CV error:', err);
    return fail(res, 'Failed to remove CV', 500);
  }
});

// GET /api/users/search?q=&role=&limit=
router.get('/search', verifyToken, requireAuth, async (req, res) => {
  try {
    const rows = await User.search(req.query.q, req.query.role, Number(req.query.limit) || 10);
    const results = rows.map((u) => ({
      id: u.id,
      display_name: profileService.displayNameOf(u),
      profile_image_url: u.profile_image_url || null,
      role: u.role,
      skills: profileService.parseSkills(u.skills)
    }));
    return ok(res, results);
  } catch (err) {
    console.error('Search users error:', err);
    return fail(res, 'Search failed', 500);
  }
});

// GET /api/users/:id/profile — public profile (must be last)
router.get('/:id/profile', async (req, res) => {
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) return fail(res, 'User not found', 404);
    const completed = await User.completedContractsCount(user.id, user.role);
    return ok(res, profileService.publicProfile(user, { completed_contracts: completed }));
  } catch (err) {
    console.error('Public profile error:', err);
    return fail(res, 'Failed to load profile', 500);
  }
});

module.exports = router;
