const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { AppError } = require('../middleware/errorHandler');
const audit = require('../services/auditService');
const Task = require('../models/Task');
const Application = require('../models/Application');
const Contract = require('../models/Contract');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const { ok, fail } = require('../utils/http');

// GET /api/applications/mine — a freelancer's own applications
router.get('/mine', verifyToken, requireAuth, requireRole(['freelancer']), async (req, res) => {
  try {
    const applications = await Application.findByFreelancer(req.user.userId);
    return ok(res, applications);
  } catch (err) {
    console.error('My applications error:', err);
    return fail(res, 'Failed to load applications', 500);
  }
});

// POST /api/applications — apply for a task (freelancer only)
router.post('/', verifyToken, requireAuth, requireRole(['freelancer']), validate(schemas.applyToTask), async (req, res) => {
  try {
    const { task_id, cover_letter, proposed_price } = req.body;

    const task = await Task.findRawById(task_id);
    if (!task) return fail(res, 'Task not found', 404);
    if (task.status !== 'open') return fail(res, 'This task is no longer accepting applications');
    if (task.client_id === req.user.userId) return fail(res, 'You cannot apply to your own task');

    const existing = await Application.findByTaskAndFreelancer(task_id, req.user.userId);
    if (existing) return fail(res, 'You have already applied to this task', 409);

    const application = await Application.create({
      task_id,
      freelancer_id: req.user.userId,
      cover_letter: cover_letter || null,
      proposed_price: proposed_price === '' || proposed_price === undefined ? null : proposed_price
    });

    return ok(res, application, 201);
  } catch (err) {
    console.error('Apply error:', err);
    return fail(res, 'Failed to submit application', 500);
  }
});

// PATCH /api/applications/:id — client accepts or rejects
router.patch('/:id', verifyToken, requireAuth, requireRole(['client']), validate(schemas.handleApplication), async (req, res) => {
  try {
    const { action } = req.body;

    const application = await Application.findById(req.params.id);
    if (!application) return fail(res, 'Application not found', 404);

    const task = await Task.findRawById(application.task_id);
    if (!task) return fail(res, 'Task not found', 404);
    if (task.client_id !== req.user.userId) return fail(res, 'Forbidden', 403);
    if (application.status !== 'pending') return fail(res, 'This application has already been handled');

    if (action === 'reject') {
      const updated = await Application.setStatus(application.id, 'rejected');
      audit.log(req, 'application.rejected', { userId: req.user.userId, metadata: { application_id: application.id } });
      return ok(res, { application: updated });
    }

    // accept → hire.
    // Hiring writes to four tables (contracts, applications ×2, tasks). Any of
    // them failing halfway would leave money-bearing state inconsistent — e.g. a
    // contract with no accepted application, or a task still "open" that already
    // has a contract. So the whole thing runs in ONE transaction: Knex commits
    // only if the callback resolves, and rolls back everything if it throws.
    const agreedPrice = application.proposed_price ?? task.price;
    let contract;

    try {
      contract = await db.transaction(async (trx) => {
        // Re-read the task WITH A ROW LOCK inside the transaction. The earlier
        // read was outside it, so two concurrent accepts could both have seen
        // status='open' and double-hired. FOR UPDATE serialises them: the second
        // waits, then sees status='in_progress' and is rejected below.
        const lockedTask = await Task.lockById(task.id, trx);
        if (!lockedTask) throw new AppError('Task not found', 404);
        if (lockedTask.status !== 'open') throw new AppError('This task already has a hired freelancer', 400);

        const created = await Contract.create(
          {
            task_id: lockedTask.id,
            client_id: lockedTask.client_id,
            freelancer_id: application.freelancer_id,
            agreed_price: agreedPrice,
            status: 'pending',
            escrow_status: 'not_funded'
          },
          trx
        );

        await Application.setStatus(application.id, 'accepted', trx);
        await Application.rejectOthers(lockedTask.id, application.id, trx);
        await Task.setStatus(lockedTask.id, 'in_progress', trx);

        return created;
      });
    } catch (err) {
      // Business-rule rejections (e.g. already hired) are 4xx, not 500.
      if (err instanceof AppError) return fail(res, err.message, err.status);
      throw err;
    }

    audit.log(req, 'application.accepted', {
      userId: req.user.userId,
      metadata: { application_id: application.id, contract_id: contract.id, amount: agreedPrice }
    });

    return ok(res, { application: { ...application, status: 'accepted' }, contract }, 201);
  } catch (err) {
    console.error('Handle application error:', err);
    return fail(res, 'Failed to update application', 500);
  }
});

// DELETE /api/applications/:id — freelancer withdraws
router.delete('/:id', verifyToken, requireAuth, requireRole(['freelancer']), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return fail(res, 'Application not found', 404);
    if (application.freelancer_id !== req.user.userId) return fail(res, 'Forbidden', 403);
    if (application.status !== 'pending') return fail(res, 'Only pending applications can be withdrawn');

    const updated = await Application.setStatus(application.id, 'withdrawn');
    return ok(res, updated);
  } catch (err) {
    console.error('Withdraw error:', err);
    return fail(res, 'Failed to withdraw application', 500);
  }
});

module.exports = router;
