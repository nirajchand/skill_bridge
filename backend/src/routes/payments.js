const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const Contract = require('../models/Contract');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const User = require('../models/User');
const stripeService = require('../services/stripeService');
const email = require('../services/emailService');
const audit = require('../services/auditService');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { ok, fail } = require('../utils/http');

/**
 * Stripe card errors (e.g. "Your card was declined") are written for end users
 * and must reach them. Every other error (invalid request, API, network, DB) may
 * contain internal detail, so it is logged server-side and replaced with a
 * generic message — never echoed to the client.
 */
function safePaymentError(err, fallback) {
  return err && err.type === 'StripeCardError' && err.message ? err.message : fallback;
}

// GET /api/payments/config — publishable key + whether Stripe is configured
router.get('/config', (req, res) =>
  ok(res, {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    configured: stripeService.isConfigured
  })
);

// POST /api/payments/contracts/:id/intent — create a PaymentIntent to fund escrow
router.post('/contracts/:id/intent', verifyToken, requireAuth, requireRole(['client']), async (req, res) => {
  try {
    if (!stripeService.isConfigured) return fail(res, 'Payments are not configured on the server', 400);
    const contract = await Contract.findRawById(req.params.id);
    if (!contract) return fail(res, 'Contract not found', 404);
    if (contract.client_id !== req.user.userId) return fail(res, 'Forbidden', 403);
    if (contract.status !== 'pending' || contract.escrow_status === 'funded') {
      return fail(res, 'This contract cannot be funded');
    }

    const { clientSecret, paymentIntentId } = await stripeService.createPaymentIntent(
      contract.agreed_price,
      contract.id,
      contract.client_id
    );
    await Contract.update(contract.id, { stripe_payment_intent_id: paymentIntentId });
    return ok(res, { clientSecret, paymentIntentId, amount: contract.agreed_price }, 201);
  } catch (err) {
    console.error('Create intent error:', err);
    return fail(res, safePaymentError(err, 'Failed to start payment'), 500);
  }
});

// POST /api/payments/contracts/:id/confirm — verify the intent and fund escrow
router.post('/contracts/:id/confirm', verifyToken, requireAuth, requireRole(['client']), async (req, res) => {
  try {
    const contract = await Contract.findRawById(req.params.id);
    if (!contract) return fail(res, 'Contract not found', 404);
    if (contract.client_id !== req.user.userId) return fail(res, 'Forbidden', 403);
    if (contract.escrow_status === 'funded') return ok(res, contract); // idempotent

    const paymentIntentId = req.body.payment_intent_id || contract.stripe_payment_intent_id;
    if (!paymentIntentId) return fail(res, 'Missing payment reference');

    const result = await stripeService.retrievePaymentIntent(paymentIntentId);
    if (result.status !== 'succeeded') {
      return fail(res, `Payment not completed (status: ${result.status})`, 402);
    }

    const updated = await Contract.update(contract.id, {
      escrow_status: 'funded',
      status: 'in_progress',
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: result.chargeId,
      funded_at: db.fn.now()
    });

    await Payment.create({
      contract_id: contract.id,
      payer_id: contract.client_id,
      payee_id: contract.freelancer_id,
      amount: contract.agreed_price,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: result.chargeId,
      payment_status: 'succeeded',
      payment_type: 'initial'
    });

    const freelancer = await User.findById(contract.freelancer_id);
    if (freelancer) email.sendPaymentFundedEmail(freelancer.email, contract.task_id, contract.agreed_price);

    audit.log(req, 'payment.escrow_funded', {
      userId: contract.client_id,
      metadata: { contract_id: contract.id, amount: contract.agreed_price }
    });

    return ok(res, updated);
  } catch (err) {
    console.error('Confirm payment error:', err);
    return fail(res, safePaymentError(err, 'Failed to confirm payment'), 500);
  }
});

// GET /api/payments/contracts/:id — payment history for a contract
router.get('/contracts/:id', verifyToken, requireAuth, async (req, res) => {
  try {
    const contract = await Contract.findRawById(req.params.id);
    if (!contract) return fail(res, 'Contract not found', 404);
    if (contract.client_id !== req.user.userId && contract.freelancer_id !== req.user.userId) {
      return fail(res, 'Forbidden', 403);
    }
    return ok(res, await Payment.findByContract(contract.id));
  } catch (err) {
    console.error('Payment history error:', err);
    return fail(res, 'Failed to load payment history', 500);
  }
});

// GET /api/payments/earnings — freelancer earnings summary
router.get('/earnings', verifyToken, requireAuth, requireRole(['freelancer']), async (req, res) => {
  try {
    const id = req.user.userId;
    const totalEarned = await Payment.totalReleasedToFreelancer(id);
    const withdrawn = await Payout.totalWithdrawn(id);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthRow = await db('payments')
      .where({ payee_id: id, payment_status: 'succeeded' })
      .whereIn('payment_type', ['release', 'dispute_split'])
      .where('created_at', '>=', startOfMonth)
      .sum('amount as total')
      .first();

    const escrowRow = await db('contracts')
      .where({ freelancer_id: id, escrow_status: 'funded' })
      .sum('agreed_price as total')
      .first();

    return ok(res, {
      total_earned: totalEarned,
      this_month: Number(monthRow?.total || 0),
      pending_payout: Number(escrowRow?.total || 0),
      available_to_withdraw: Math.max(0, totalEarned - withdrawn)
    });
  } catch (err) {
    console.error('Earnings error:', err);
    return fail(res, 'Failed to load earnings', 500);
  }
});

// GET /api/payments/payouts — freelancer payout history
router.get('/payouts', verifyToken, requireAuth, requireRole(['freelancer']), async (req, res) => {
  try {
    return ok(res, await Payout.findByFreelancer(req.user.userId));
  } catch (err) {
    console.error('List payouts error:', err);
    return fail(res, 'Failed to load payouts', 500);
  }
});

// POST /api/payments/payouts/request — request a payout (simulated instant transfer)
router.post('/payouts/request', verifyToken, requireAuth, requireRole(['freelancer']), async (req, res) => {
  try {
    const id = req.user.userId;
    const totalEarned = await Payment.totalReleasedToFreelancer(id);
    const withdrawn = await Payout.totalWithdrawn(id);
    const available = Math.max(0, totalEarned - withdrawn);

    const amount = req.body.amount != null && req.body.amount !== '' ? Number(req.body.amount) : available;
    if (!Number.isFinite(amount) || amount <= 0) return fail(res, 'Enter a valid amount');
    if (amount > available) return fail(res, `You can withdraw up to $${available.toFixed(2)}`);

    // SIMULATED transfer — real payouts need Stripe Connect onboarding.
    const transfer = await stripeService.createTransferToFreelancer(id, amount, null);
    const payout = await Payout.create({
      freelancer_id: id,
      amount,
      stripe_transfer_id: transfer.transferId,
      payout_status: 'paid',
      processed_at: db.fn.now(),
      completed_at: db.fn.now()
    });

    const user = await User.findById(id);
    if (user) email.sendPayoutProcessedEmail(user.email, amount);
    return ok(res, payout, 201);
  } catch (err) {
    console.error('Payout request error:', err);
    return fail(res, 'Failed to request payout', 500);
  }
});

module.exports = router;
