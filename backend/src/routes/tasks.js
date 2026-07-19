const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Application = require('../models/Application');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const { ok, fail } = require('../utils/http');

const CATEGORIES = ['writing', 'design', 'development', 'marketing', 'data', 'other'];

// GET /api/tasks — browse open tasks (freelancer feed)
router.get('/', verifyToken, requireAuth, async (req, res) => {
  try {
    const tasks = await Task.browse({
      category: req.query.category,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      search: req.query.search,
      sort: req.query.sort
    });
    return ok(res, tasks);
  } catch (err) {
    console.error('Browse tasks error:', err);
    return fail(res, 'Failed to load tasks', 500);
  }
});

// GET /api/tasks/mine — a client's own tasks
router.get('/mine', verifyToken, requireAuth, requireRole(['client']), async (req, res) => {
  try {
    const tasks = await Task.findByClient(req.user.userId);
    return ok(res, tasks);
  } catch (err) {
    console.error('My tasks error:', err);
    return fail(res, 'Failed to load your tasks', 500);
  }
});

// GET /api/tasks/stats — client task counts by status
router.get('/stats', verifyToken, requireAuth, requireRole(['client']), async (req, res) => {
  try {
    const counts = await Task.countByClient(req.user.userId);
    return ok(res, counts);
  } catch (err) {
    console.error('Task stats error:', err);
    return fail(res, 'Failed to load stats', 500);
  }
});

// POST /api/tasks — create a task (client only)
router.post('/', verifyToken, requireAuth, requireRole(['client']), validate(schemas.createTask), async (req, res) => {
  try {
    const { title, description, category, price, deadline, skills_required } = req.body;
    const task = await Task.create({
      client_id: req.user.userId,
      title: title.trim(),
      description: description.trim(),
      category,
      price,
      deadline: deadline || null,
      skills_required: skills_required || null
    });
    return ok(res, task, 201);
  } catch (err) {
    console.error('Create task error:', err);
    return fail(res, 'Failed to create task', 500);
  }
});

// GET /api/tasks/:id — task detail
router.get('/:id', verifyToken, requireAuth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return fail(res, 'Task not found', 404);
    return ok(res, task);
  } catch (err) {
    console.error('Task detail error:', err);
    return fail(res, 'Failed to load task', 500);
  }
});

// GET /api/tasks/:id/applications — applicants (owning client only)
router.get('/:id/applications', verifyToken, requireAuth, requireRole(['client']), async (req, res) => {
  try {
    const task = await Task.findRawById(req.params.id);
    if (!task) return fail(res, 'Task not found', 404);
    if (task.client_id !== req.user.userId) return fail(res, 'Forbidden', 403);

    const applications = await Application.findByTask(req.params.id);
    return ok(res, applications);
  } catch (err) {
    console.error('Task applications error:', err);
    return fail(res, 'Failed to load applications', 500);
  }
});

// PATCH /api/tasks/:id — edit (owning client, only while open)
router.patch('/:id', verifyToken, requireAuth, requireRole(['client']), validate(schemas.updateTask), async (req, res) => {
  try {
    const task = await Task.findRawById(req.params.id);
    if (!task) return fail(res, 'Task not found', 404);
    if (task.client_id !== req.user.userId) return fail(res, 'Forbidden', 403);
    if (task.status !== 'open') return fail(res, 'Cannot edit a task once it has an active contract');

    // req.body is already validated + stripped of unknown fields.
    const updates = { ...req.body };
    if (updates.title) updates.title = updates.title.trim();
    if (updates.description) updates.description = updates.description.trim();
    if ('deadline' in updates) updates.deadline = updates.deadline || null;
    if ('skills_required' in updates) updates.skills_required = updates.skills_required || null;

    const updated = await Task.update(req.params.id, updates);
    return ok(res, updated);
  } catch (err) {
    console.error('Edit task error:', err);
    return fail(res, 'Failed to update task', 500);
  }
});

// DELETE /api/tasks/:id — cancel (owning client, only while open)
router.delete('/:id', verifyToken, requireAuth, requireRole(['client']), async (req, res) => {
  try {
    const task = await Task.findRawById(req.params.id);
    if (!task) return fail(res, 'Task not found', 404);
    if (task.client_id !== req.user.userId) return fail(res, 'Forbidden', 403);
    if (task.status !== 'open') return fail(res, 'Cannot cancel a task with an active contract');

    await Task.softDelete(req.params.id);
    return ok(res, { id: req.params.id, cancelled: true });
  } catch (err) {
    console.error('Cancel task error:', err);
    return fail(res, 'Failed to cancel task', 500);
  }
});

module.exports = router;
