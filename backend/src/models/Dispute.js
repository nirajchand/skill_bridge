const db = require('../db/connection');

class Dispute {
  static async create(data, trx = db) {
    const [dispute] = await trx('disputes').insert(data).returning('*');
    return dispute;
  }

  static async findById(id) {
    return db('disputes')
      .join('contracts', 'contracts.id', 'disputes.contract_id')
      .join('tasks', 'tasks.id', 'contracts.task_id')
      .where('disputes.id', id)
      .select('disputes.*', db.raw('tasks.title as task_title'))
      .first();
  }

  static async findRawById(id) {
    return db('disputes').where({ id }).first();
  }

  // Disputes on contracts where the user is client or freelancer.
  static async findForUser(userId) {
    return db('disputes')
      .join('contracts', 'contracts.id', 'disputes.contract_id')
      .join('tasks', 'tasks.id', 'contracts.task_id')
      .where('contracts.client_id', userId)
      .orWhere('contracts.freelancer_id', userId)
      .select(
        'disputes.*',
        db.raw('tasks.title as task_title'),
        db.raw('contracts.client_id as client_id'),
        db.raw('contracts.freelancer_id as freelancer_id')
      )
      .orderBy('disputes.created_at', 'desc');
  }

  static async findByContract(contractId) {
    return db('disputes').where({ contract_id: contractId }).first();
  }

  // Admin: list disputes with task + party emails, optional status filter.
  static async listAll({ status } = {}) {
    const q = db('disputes')
      .join('contracts', 'contracts.id', 'disputes.contract_id')
      .join('tasks', 'tasks.id', 'contracts.task_id')
      .join('users as client', 'client.id', 'contracts.client_id')
      .join('users as freelancer', 'freelancer.id', 'contracts.freelancer_id')
      .select(
        'disputes.*',
        db.raw('tasks.title as task_title'),
        db.raw('contracts.agreed_price as agreed_price'),
        db.raw('client.email as client_email'),
        db.raw('freelancer.email as freelancer_email')
      )
      .orderBy('disputes.created_at', 'asc');
    if (status) q.where('disputes.status', status);
    return q;
  }

  static async update(id, fields, trx = db) {
    const [dispute] = await trx('disputes')
      .where({ id })
      .update({ ...fields, updated_at: db.fn.now() })
      .returning('*');
    return dispute;
  }
}

module.exports = Dispute;
