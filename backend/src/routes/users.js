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
const { ok, fail } = require('../utils/http');

const isValidUrl = (v) => /^https?:\/\/.+/i.test(v);

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
router.patch('/me/profile', verifyToken, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return fail(res, 'User not found', 404);

    const {
      display_name,
      bio,
      location,
      skills,
      hourly_rate,
      portfolio_url,
      company_name,
      company_website
    } = req.body;
    const updates = {};

    if (display_name !== undefined) {
      if (display_name.trim().length < 2 || display_name.length > 100) {
        return fail(res, 'Display name must be 2-100 characters');
      }
      updates.display_name = display_name.trim();
    }
    if (bio !== undefined) {
      if (bio.length > 500) return fail(res, 'Bio cannot exceed 500 characters');
      updates.bio = bio.trim() || null;
    }
    if (location !== undefined) {
      if (location.length > 100) return fail(res, 'Location must be 100 characters or less');
      updates.location = location.trim() || null;
    }
    if (skills !== undefined) {
      if (!Array.isArray(skills)) return fail(res, 'Skills must be an array');
      const cleaned = skills.map((s) => String(s).trim()).filter(Boolean);
      if (cleaned.length > 10) return fail(res, 'You can list up to 10 skills');
      if (cleaned.some((s) => s.length < 2 || s.length > 50)) {
        return fail(res, 'Each skill must be 2-50 characters');
      }
      updates.skills = JSON.stringify(cleaned);
    }
    if (hourly_rate !== undefined) {
      if (hourly_rate === null || hourly_rate === '') {
        updates.hourly_rate = null;
      } else {
        const rate = Number(hourly_rate);
        if (!Number.isFinite(rate) || rate < 5 || rate > 500) {
          return fail(res, 'Hourly rate must be between $5 and $500');
        }
        updates.hourly_rate = rate;
      }
    }
    if (portfolio_url !== undefined) {
      if (portfolio_url && !isValidUrl(portfolio_url)) return fail(res, 'Please enter a valid portfolio URL');
      updates.portfolio_url = portfolio_url || null;
    }
    if (company_website !== undefined) {
      if (company_website && !isValidUrl(company_website)) return fail(res, 'Please enter a valid website URL');
      updates.company_website = company_website || null;
    }
    if (company_name !== undefined) {
      if (company_name.length > 200) return fail(res, 'Company name too long');
      updates.company_name = company_name.trim() || null;
    }

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
