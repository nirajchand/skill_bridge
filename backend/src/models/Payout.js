const db = require('../db/connection');

class Payout {
  static async create(data) {
    const [payout] = await db('payouts').insert(data).returning('*');
    return payout;
  }

  static async findByFreelancer(freelancerId) {
    return db('payouts').where({ freelancer_id: freelancerId }).orderBy('requested_at', 'desc');
  }

  // Sum of payouts that are not failed (already withdrawn or in-flight).
  static async totalWithdrawn(freelancerId) {
    const row = await db('payouts')
      .where({ freelancer_id: freelancerId })
      .whereNot('payout_status', 'failed')
      .sum('amount as total')
      .first();
    return Number(row?.total || 0);
  }

  static async setStatus(id, status, extra = {}) {
    const [payout] = await db('payouts').where({ id }).update({ payout_status: status, ...extra }).returning('*');
    return payout;
  }

  static async findById(id) {
    return db('payouts').where({ id }).first();
  }

  static async findByTransferId(transferId) {
    return db('payouts').where({ stripe_transfer_id: transferId }).first();
  }

  // Admin: list payouts with freelancer email, optional status filter.
  static async listAll({ status } = {}) {
    const q = db('payouts')
      .join('users', 'users.id', 'payouts.freelancer_id')
      .select('payouts.*', db.raw('users.email as freelancer_email'))
      .orderBy('payouts.requested_at', 'desc');
    if (status) q.where('payouts.payout_status', status);
    return q;
  }
}

module.exports = Payout;
