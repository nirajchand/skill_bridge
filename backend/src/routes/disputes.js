const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const Dispute = require('../models/Dispute');
const Contract = require('../models/Contract');
const Task = require('../models/Task');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const audit = require('../services/auditService');
const { ok, fail } = require('../utils/http');

// GET /api/disputes — disputes involving the current user
router.get('/', verifyToken, requireAuth, async (req, res) => {
  try {
    const disputes = await Dispute.findForUser(req.user.userId);
    return ok(res, disputes);
  } catch (err) {
    console.error('List disputes error:', err);
    return fail(res, 'Failed to load disputes', 500);
  }
});

// GET /api/disputes/:id — detail
router.get('/:id', verifyToken, requireAuth, async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return fail(res, 'Dispute not found', 404);

    const contract = await Contract.findRawById(dispute.contract_id);
    if (!contract || (contract.client_id !== req.user.userId && contract.freelancer_id !== req.user.userId)) {
      return fail(res, 'Forbidden', 403);
    }
    return ok(res, dispute);
  } catch (err) {
    console.error('Dispute detail error:', err);
    return fail(res, 'Failed to load dispute', 500);
  }
});

// POST /api/disputes — raise a dispute on a contract
router.post('/', verifyToken, requireAuth, validate(schemas.raiseDispute), async (req, res) => {
  try {
    const { contract_id, reason, description } = req.body;

    const contract = await Contract.findRawById(contract_id);
    if (!contract) return fail(res, 'Contract not found', 404);
    if (contract.client_id !== req.user.userId && contract.freelancer_id !== req.user.userId) {
      return fail(res, 'Forbidden', 403);
    }

    const existing = await Dispute.findByContract(contract_id);
    if (existing) return fail(res, 'A dispute already exists for this contract', 409);

    // Atomic: a dispute row must never exist without its contract/task being
    // flagged disputed (that would let the contract keep progressing normally).
    const dispute = await db.transaction(async (trx) => {
      const d = await Dispute.create(
        {
          contract_id,
          raised_by: req.user.userId,
          reason,
          description: description.trim(),
          status: 'open'
        },
        trx
      );
      await Contract.update(contract_id, { status: 'disputed' }, trx);
      await Task.setStatus(contract.task_id, 'disputed', trx);
      return d;
    });
    audit.log(req, 'dispute.raised', { userId: req.user.userId, metadata: { contract_id, dispute_id: dispute.id, reason } });

    return ok(res, dispute, 201);
  } catch (err) {
    console.error('Raise dispute error:', err);
    return fail(res, 'Failed to raise dispute', 500);
  }
});

module.exports = router;
