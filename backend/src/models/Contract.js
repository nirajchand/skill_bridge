const db = require('../db/connection');
const { displayNameSql } = require('../utils/sql');

class Contract {
  // Every writer accepts an optional Knex transaction (`trx`). Defaulting to the
  // pooled `db` keeps single-write callers unchanged, while multi-step flows can
  // pass a trx so all writes commit or roll back as one atomic unit.
  static async create(data, trx = db) {
    const [contract] = await trx('contracts').insert(data).returning('*');
    return contract;
  }

  static async findRawById(id) {
    return db('contracts').where({ id }).first();
  }

  // Lookups used by the Stripe webhook to map events back to a contract.
  static async findByPaymentIntent(paymentIntentId) {
    return db('contracts').where({ stripe_payment_intent_id: paymentIntentId }).first();
  }

  static async findByChargeId(chargeId) {
    return db('contracts').where({ stripe_charge_id: chargeId }).first();
  }

  // Full detail with task title and both party emails.
  static async findById(id) {
    return db('contracts')
      .join('tasks', 'tasks.id', 'contracts.task_id')
      .join('users as client', 'client.id', 'contracts.client_id')
      .join('users as freelancer', 'freelancer.id', 'contracts.freelancer_id')
      .where('contracts.id', id)
      .select(
        'contracts.*',
        db.raw('tasks.title as task_title'),
        db.raw(displayNameSql('client', 'client_name')),
        db.raw(displayNameSql('freelancer', 'freelancer_name'))
      )
      .first();
  }

  // Contracts for a user, whether they are the client or the freelancer.
  static async findForUser(userId) {
    return db('contracts')
      .join('tasks', 'tasks.id', 'contracts.task_id')
      .join('users as client', 'client.id', 'contracts.client_id')
      .join('users as freelancer', 'freelancer.id', 'contracts.freelancer_id')
      .where('contracts.client_id', userId)
      .orWhere('contracts.freelancer_id', userId)
      .select(
        'contracts.*',
        db.raw('tasks.title as task_title'),
        db.raw(displayNameSql('client', 'client_name')),
        db.raw(displayNameSql('freelancer', 'freelancer_name'))
      )
      .orderBy('contracts.created_at', 'desc');
  }

  static async update(id, data, trx = db) {
    const [contract] = await trx('contracts')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return contract;
  }
}

module.exports = Contract;
