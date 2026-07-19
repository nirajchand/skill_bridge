const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const Contract = require('../models/Contract');
const Task = require('../models/Task');
const WorkSubmission = require('../models/WorkSubmission');
const Payment = require('../models/Payment');
const User = require('../models/User');
const email = require('../services/emailService');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { authorizeResource } = require('../middleware/ownership');
const { validate } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const { ok, fail } = require('../utils/http');

// Shared ownership guards (centralized IDOR protection).
const partyOnDetail = authorizeResource({
  loader: Contract.findById, // enriched (task title + emails)
  ownerFields: ['client_id', 'freelancer_id'],
  attachAs: 'contract'
});
const freelancerOwns = authorizeResource({
  loader: Contract.findRawById,
  ownerFields: ['freelancer_id'],
  attachAs: 'contract'
});
const clientOwns = authorizeResource({
  loader: Contract.findRawById,
  ownerFields: ['client_id'],
  attachAs: 'contract'
});

// GET /api/contracts — contracts where the user is client or freelancer
router.get('/', verifyToken, requireAuth, async (req, res) => {
  try {
    return ok(res, await Contract.findForUser(req.user.userId));
  } catch (err) {
    console.error('List contracts error:', err);
    return fail(res, 'Failed to load contracts', 500);
  }
});

// GET /api/contracts/:id — detail (+ submissions)
router.get('/:id', verifyToken, requireAuth, partyOnDetail, async (req, res) => {
  try {
    const submissions = await WorkSubmission.findByContract(req.contract.id);
    return ok(res, { ...req.contract, submissions });
  } catch (err) {
    console.error('Contract detail error:', err);
    return fail(res, 'Failed to load contract', 500);
  }
});

// Escrow funding goes through Stripe: see routes/payments.js

// POST /api/contracts/:id/submissions — freelancer submits work
router.post('/:id/submissions', verifyToken, requireAuth, requireRole(['freelancer']), freelancerOwns, validate(schemas.submitWork), async (req, res) => {
  try {
    const contract = req.contract;
    if (!['in_progress', 'submitted'].includes(contract.status)) {
      return fail(res, 'Work can only be submitted on a funded, in-progress contract');
    }
    if (contract.escrow_status !== 'funded') {
      return fail(res, 'Waiting for the client to fund payment before you can submit work');
    }

    const { description, files_url } = req.body;
    const submission = await WorkSubmission.create({
      contract_id: contract.id,
      description: description.trim(),
      files_url: files_url || null,
      status: 'pending_review'
    });

    await Contract.update(contract.id, { status: 'submitted' });
    return ok(res, submission, 201);
  } catch (err) {
    console.error('Submit work error:', err);
    return fail(res, 'Failed to submit work', 500);
  }
});

// PATCH /api/contracts/:id/approve-work — client approves, escrow released
router.patch('/:id/approve-work', verifyToken, requireAuth, requireRole(['client']), clientOwns, async (req, res) => {
  try {
    const contract = req.contract;
    if (contract.status !== 'submitted') return fail(res, 'There is no submitted work to approve');
    if (contract.escrow_status !== 'funded') return fail(res, 'Escrow is not funded for this contract');

    // Releasing escrow touches contracts, payments, work_submissions and tasks.
    // A partial failure could credit the freelancer's ledger without completing
    // the contract (or vice versa), so all four writes are one atomic unit.
    const submissions = await WorkSubmission.findByContract(contract.id);
    const updated = await db.transaction(async (trx) => {
      const c = await Contract.update(
        contract.id,
        { status: 'completed', escrow_status: 'released', approved_at: db.fn.now() },
        trx
      );

      await Payment.create(
        {
          contract_id: contract.id,
          payer_id: contract.client_id,
          payee_id: contract.freelancer_id,
          amount: contract.agreed_price,
          stripe_payment_intent_id: contract.stripe_payment_intent_id,
          stripe_charge_id: contract.stripe_charge_id,
          payment_status: 'succeeded',
          payment_type: 'release'
        },
        trx
      );

      if (submissions[0]) await WorkSubmission.setStatus(submissions[0].id, 'approved', trx);
      await Task.setStatus(contract.task_id, 'completed', trx);
      return c;
    });

    const freelancer = await User.findById(contract.freelancer_id);
    if (freelancer) email.sendWorkApprovedEmail(freelancer.email, contract.task_id, contract.agreed_price);

    return ok(res, updated);
  } catch (err) {
    console.error('Approve work error:', err);
    return fail(res, 'Failed to approve work', 500);
  }
});

// PATCH /api/contracts/:id/request-revision — client requests changes
router.patch('/:id/request-revision', verifyToken, requireAuth, requireRole(['client']), clientOwns, validate(schemas.requestRevision), async (req, res) => {
  try {
    const contract = req.contract;
    if (contract.status !== 'submitted') return fail(res, 'There is no submitted work to revise');

    const { revision_notes } = req.body;
    const updated = await Contract.update(contract.id, { status: 'in_progress', revision_notes: revision_notes.trim() });
    const submissions = await WorkSubmission.findByContract(contract.id);
    if (submissions[0]) await WorkSubmission.setStatus(submissions[0].id, 'requested_revision');

    return ok(res, updated);
  } catch (err) {
    console.error('Request revision error:', err);
    return fail(res, 'Failed to request revision', 500);
  }
});

module.exports = router;
