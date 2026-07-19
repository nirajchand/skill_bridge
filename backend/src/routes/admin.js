const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const Dispute = require('../models/Dispute');
const Contract = require('../models/Contract');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const stripeService = require('../services/stripeService');
const audit = require('../services/auditService');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { AppError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const { ok, fail } = require('../utils/http');

// Every route here is admin-only.
router.use(verifyToken, requireAuth, requireAdmin);

// ---- Disputes ----

// GET /api/admin/disputes?status=open
router.get('/disputes', async (req, res) => {
  try {
    return ok(res, await Dispute.listAll({ status: req.query.status }));
  } catch (err) {
    console.error('Admin list disputes error:', err);
    return fail(res, 'Failed to load disputes', 500);
  }
});

// GET /api/admin/disputes/:id
router.get('/disputes/:id', async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return fail(res, 'Dispute not found', 404);
    return ok(res, dispute);
  } catch (err) {
    console.error('Admin dispute detail error:', err);
    return fail(res, 'Failed to load dispute', 500);
  }
});

// Helper: refund via Stripe when configured, otherwise simulate (dev escrow).
async function doRefund(contract, amount) {
  if (stripeService.isConfigured && contract.stripe_payment_intent_id) {
    return stripeService.createRefund(contract.stripe_payment_intent_id, amount);
  }
  console.log(`[stripe:SIMULATED] refund $${amount} → client ${contract.client_id} (contract ${contract.id})`);
  return { refundId: `sim_re_${Date.now()}`, status: 'succeeded', simulated: true };
}

// POST /api/admin/disputes/:id/resolve
router.post('/disputes/:id/resolve', validate(schemas.resolveDispute), async (req, res) => {
  try {
    const { resolution_type, split_freelancer_percentage, admin_notes } = req.body;

    /**
     * Resolving a dispute moves real money and writes to three tables. Two risks:
     *  1. Concurrency — two admins resolving the same dispute would double-pay.
     *     Fixed with SELECT … FOR UPDATE on the dispute row: the second request
     *     blocks, then sees status='resolved' and is rejected.
     *  2. Partial failure — the DB writes are wrapped in one transaction so they
     *     all land or none do.
     *
     * NOTE: the Stripe transfer/refund is an EXTERNAL call and cannot be rolled
     * back by the database. It is issued inside the lock (serialised, so never
     * duplicated) and if the subsequent commit fails we log loudly for manual
     * reconciliation — the honest trade-off, since no DB transaction can undo a
     * completed payment. The alternative (commit first, pay after) is worse: it
     * would mark money as moved that never actually moved.
     */
    let outcome = {};
    let resolved;

    try {
      resolved = await db.transaction(async (trx) => {
        const dispute = await trx('disputes').where({ id: req.params.id }).forUpdate().first();
        if (!dispute) throw new AppError('Dispute not found', 404);
        if (dispute.status === 'resolved') throw new AppError('Dispute already resolved', 400);

        const contract = await trx('contracts').where({ id: dispute.contract_id }).forUpdate().first();
        if (!contract) throw new AppError('Contract not found', 404);

        const amount = Number(contract.agreed_price);
        let splitPct = null;

        if (resolution_type === 'release') {
          await stripeService.createTransferToFreelancer(contract.freelancer_id, amount, contract.id);
          await Contract.update(contract.id, { status: 'completed', escrow_status: 'released' }, trx);
          await Payment.create(
            {
              contract_id: contract.id,
              payer_id: contract.client_id,
              payee_id: contract.freelancer_id,
              amount,
              payment_status: 'succeeded',
              payment_type: 'release'
            },
            trx
          );
          outcome = { freelancer_amount: amount, refund_amount: 0 };
        } else if (resolution_type === 'refund') {
          await doRefund(contract, amount);
          await Contract.update(contract.id, { status: 'cancelled', escrow_status: 'refunded' }, trx);
          await Payment.create(
            {
              contract_id: contract.id,
              payer_id: contract.client_id,
              payee_id: contract.freelancer_id,
              amount,
              payment_status: 'refunded',
              payment_type: 'refund'
            },
            trx
          );
          outcome = { freelancer_amount: 0, refund_amount: amount };
        } else {
          // split — Joi already guarantees 0..100 and that it is present.
          splitPct = Number(split_freelancer_percentage);
          const freelancerAmount = Math.round(amount * splitPct) / 100;
          const refundAmount = Math.round((amount - freelancerAmount) * 100) / 100;
          await stripeService.createTransferToFreelancer(contract.freelancer_id, freelancerAmount, contract.id);
          if (refundAmount > 0) await doRefund(contract, refundAmount);
          await Contract.update(contract.id, { status: 'completed', escrow_status: 'released' }, trx);
          await Payment.create(
            {
              contract_id: contract.id,
              payer_id: contract.client_id,
              payee_id: contract.freelancer_id,
              amount: freelancerAmount,
              payment_status: 'split',
              payment_type: 'dispute_split'
            },
            trx
          );
          outcome = { freelancer_amount: freelancerAmount, refund_amount: refundAmount };
        }

        const d = await Dispute.update(
          dispute.id,
          {
            status: 'resolved',
            resolution: admin_notes.trim(),
            resolution_type,
            split_freelancer_percentage: splitPct,
            resolved_by: req.user.userId,
            resolved_at: db.fn.now()
          },
          trx
        );

        audit.log(req, 'admin.dispute_resolved', {
          userId: req.user.userId,
          metadata: { dispute_id: dispute.id, contract_id: contract.id, resolution_type, ...outcome }
        });

        return d;
      });
    } catch (err) {
      if (err instanceof AppError) return fail(res, err.message, err.status);
      // Money may have moved before the failure — flag for reconciliation.
      console.error('[RECONCILE] dispute resolve failed AFTER a possible Stripe call:', req.params.id, err.message);
      throw err;
    }

    return ok(res, { dispute: resolved, ...outcome });
  } catch (err) {
    // Log the detail server-side; return a generic message so internal errors
    // (stack frames, driver/Stripe internals) are never disclosed to the client.
    console.error('Admin resolve dispute error:', err);
    return fail(res, 'Failed to resolve dispute', 500);
  }
});

// ---- Payouts ----

// GET /api/admin/payouts?status=pending
router.get('/payouts', async (req, res) => {
  try {
    return ok(res, await Payout.listAll({ status: req.query.status }));
  } catch (err) {
    console.error('Admin list payouts error:', err);
    return fail(res, 'Failed to load payouts', 500);
  }
});

// POST /api/admin/payouts/:id/process — mark a pending payout paid (simulated transfer)
router.post('/payouts/:id/process', async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id);
    if (!payout) return fail(res, 'Payout not found', 404);
    if (payout.payout_status !== 'pending') return fail(res, 'Payout is not pending');

    const transfer = await stripeService.createTransferToFreelancer(payout.freelancer_id, payout.amount, null);
    const updated = await Payout.setStatus(payout.id, 'paid', {
      stripe_transfer_id: transfer.transferId,
      processed_at: db.fn.now(),
      completed_at: db.fn.now()
    });
    audit.log(req, 'admin.payout_processed', {
      userId: req.user.userId,
      metadata: { payout_id: payout.id, freelancer_id: payout.freelancer_id, amount: payout.amount }
    });
    return ok(res, updated);
  } catch (err) {
    console.error('Admin process payout error:', err);
    return fail(res, 'Failed to process payout', 500);
  }
});

// ---- Users ----

// GET /api/admin/audit-logs — security event trail
router.get('/audit-logs', async (req, res) => {
  try {
    return ok(res, await AuditLog.recent(Number(req.query.limit) || 100));
  } catch (err) {
    console.error('Admin audit logs error:', err);
    return fail(res, 'Failed to load audit logs', 500);
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'email', 'role', 'is_verified', 'mfa_enabled', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(200);
    return ok(res, users);
  } catch (err) {
    console.error('Admin list users error:', err);
    return fail(res, 'Failed to load users', 500);
  }
});

module.exports = router;
