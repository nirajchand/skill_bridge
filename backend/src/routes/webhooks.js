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

/**
 * POST /webhooks/stripe
 *
 * Deliberately NOT under /api:
 *  - it must bypass the /api rate limiter (Stripe can burst/retry), and
 *  - it is authenticated by Stripe's HMAC signature, not by a session cookie.
 *
 * Authentication = signature verification. We never trust the body until
 * stripe.webhooks.constructEvent() proves it was signed with our webhook
 * secret AND the timestamp is recent (Stripe's SDK rejects replays).
 * This requires the RAW body — express.json() would break the signature, so
 * express.raw() is applied on this route only (see app.js mounting order).
 */

// --- Event handlers (each is idempotent: Stripe retries and may redeliver) ---

async function handlePaymentIntentSucceeded(req, intent) {
  const contract = await Contract.findByPaymentIntent(intent.id);
  if (!contract) {
    console.warn(`[webhook] payment_intent.succeeded for unknown contract (intent ${intent.id})`);
    return;
  }
  if (contract.escrow_status === 'funded') return; // already processed

  const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id || null;

  await Contract.update(contract.id, {
    escrow_status: 'funded',
    status: 'in_progress',
    stripe_charge_id: chargeId,
    funded_at: db.fn.now()
  });

  const existing = await Payment.findByIntent(intent.id, 'initial');
  if (!existing) {
    await Payment.create({
      contract_id: contract.id,
      payer_id: contract.client_id,
      payee_id: contract.freelancer_id,
      amount: contract.agreed_price,
      stripe_payment_intent_id: intent.id,
      stripe_charge_id: chargeId,
      payment_status: 'succeeded',
      payment_type: 'initial'
    });
  }

  const freelancer = await User.findById(contract.freelancer_id);
  if (freelancer) email.sendPaymentFundedEmail(freelancer.email, contract.task_id, contract.agreed_price);

  audit.log(req, 'payment.escrow_funded', {
    userId: contract.client_id,
    metadata: { contract_id: contract.id, amount: contract.agreed_price, via: 'webhook' }
  });
}

async function handlePaymentFailed(req, intent) {
  const contract = await Contract.findByPaymentIntent(intent.id);
  audit.log(req, 'payment.failed', {
    userId: contract?.client_id || null,
    metadata: { contract_id: contract?.id || null, reason: intent.last_payment_error?.code || 'unknown' }
  });
}

async function handleChargeRefunded(req, charge) {
  const contract = await Contract.findByChargeId(charge.id);
  if (!contract) return;
  if (contract.escrow_status === 'refunded') return; // already processed

  await Contract.update(contract.id, { escrow_status: 'refunded', status: 'cancelled' });
  audit.log(req, 'payment.refunded', {
    userId: contract.client_id,
    metadata: { contract_id: contract.id, amount: charge.amount_refunded / 100, via: 'webhook' }
  });
}

async function handleTransferEvent(req, transfer, paid) {
  const payout = await Payout.findByTransferId(transfer.id);
  if (!payout) return;
  if (payout.payout_status === (paid ? 'paid' : 'failed')) return; // already processed

  await Payout.setStatus(payout.id, paid ? 'paid' : 'failed', {
    completed_at: paid ? db.fn.now() : null
  });

  if (paid) {
    const user = await User.findById(payout.freelancer_id);
    if (user) email.sendPayoutProcessedEmail(user.email, payout.amount);
  } else {
    console.error(`[ALERT] Transfer ${transfer.id} FAILED for payout ${payout.id} — manual intervention needed`);
  }

  audit.log(req, paid ? 'payout.paid' : 'payout.failed', {
    userId: payout.freelancer_id,
    metadata: { payout_id: payout.id, amount: payout.amount, via: 'webhook' }
  });
}

router.post('/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;

  // 1. Authenticate the request. Reject anything we can't verify.
  try {
    event = stripeService.verifyWebhookSignature(req.body, signature);
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message);
    audit.log(req, 'webhook.invalid_signature', { metadata: { error: err.message } });
    return res.status(400).json({ error: `Webhook signature verification failed` });
  }

  // 2. Dispatch. Errors are logged but we still 200 so Stripe doesn't retry forever
  //    on a bug in our handler (the audit trail records what happened).
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(req, event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(req, event.data.object);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(req, event.data.object);
        break;
      case 'transfer.created':
      case 'transfer.paid':
        await handleTransferEvent(req, event.data.object, true);
        break;
      case 'transfer.failed':
        await handleTransferEvent(req, event.data.object, false);
        break;
      default:
        console.log(`[webhook] unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[webhook] handler error for ${event.type}:`, err.message);
  }

  return res.status(200).json({ received: true });
});

module.exports = router;
