/**
 * Stripe integration for SkillBridge escrow.
 *
 * REAL:      PaymentIntent creation/retrieval (escrow funding) and refunds.
 * SIMULATED: transfers/payouts to freelancers — real payouts need Stripe
 *            Connect onboarding (KYC + connected accounts) per freelancer,
 *            which is out of scope for this environment.
 */

const Stripe = require('stripe');

const secretKey = process.env.STRIPE_SECRET_KEY || '';
const isConfigured = secretKey.startsWith('sk_');
const stripe = isConfigured ? Stripe(secretKey) : null;

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

// Create a PaymentIntent to fund escrow. Returns clientSecret for the frontend.
async function createPaymentIntent(amount, contractId, clientId) {
  if (!stripe) throw new Error('Stripe is not configured');
  const intent = await stripe.paymentIntents.create({
    amount: toCents(amount),
    currency: 'usd',
    // CardElement + confirmCardPayment flow, no redirect-based methods.
    payment_method_types: ['card'],
    metadata: { contractId, clientId, purpose: 'escrow_funding' }
  });
  return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
}

// Retrieve a PaymentIntent and confirm it actually succeeded.
async function retrievePaymentIntent(paymentIntentId) {
  if (!stripe) throw new Error('Stripe is not configured');
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge']
  });
  const chargeId =
    typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id || null;
  return { status: intent.status, amount: intent.amount / 100, chargeId, intent };
}

// Refund a charge (used for dispute refunds). Real Stripe call.
async function createRefund(paymentIntentId, amount) {
  if (!stripe) throw new Error('Stripe is not configured');
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amount ? { amount: toCents(amount) } : {})
  });
  return { refundId: refund.id, status: refund.status };
}

// SIMULATED transfer to a freelancer (no Connect account available).
async function createTransferToFreelancer(freelancerId, amount, contractId) {
  console.log(`[stripe:SIMULATED] transfer $${amount} → freelancer ${freelancerId} (contract ${contractId})`);
  return { transferId: `sim_tr_${Date.now()}`, status: 'paid', simulated: true };
}

function verifyWebhookSignature(rawBody, signature) {
  if (!stripe) throw new Error('Stripe is not configured');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!webhookSecret.startsWith('whsec_')) {
    throw new Error('Webhook secret not configured');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

module.exports = {
  isConfigured,
  createPaymentIntent,
  retrievePaymentIntent,
  createRefund,
  createTransferToFreelancer,
  verifyWebhookSignature
};
