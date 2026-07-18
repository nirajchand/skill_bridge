const db = require('../db/connection');

class Payment {
  static async create(data, trx = db) {
    const [payment] = await trx('payments')
      .insert({ ...data, completed_at: data.payment_status === 'succeeded' ? db.fn.now() : null })
      .returning('*');
    return payment;
  }

  static async findByContract(contractId) {
    return db('payments').where({ contract_id: contractId }).orderBy('created_at', 'desc');
  }

  // Idempotency helper for the Stripe webhook: has this intent already been recorded?
  static async findByIntent(paymentIntentId, paymentType = 'initial') {
    return db('payments').where({ stripe_payment_intent_id: paymentIntentId, payment_type: paymentType }).first();
  }

  // Total released to a freelancer (money they've earned).
  static async totalReleasedToFreelancer(freelancerId) {
    const row = await db('payments')
      .where({ payee_id: freelancerId, payment_status: 'succeeded' })
      .whereIn('payment_type', ['release', 'dispute_split'])
      .sum('amount as total')
      .first();
    return Number(row?.total || 0);
  }
}

module.exports = Payment;
