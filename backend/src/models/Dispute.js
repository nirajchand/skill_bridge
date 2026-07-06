const db = require('../db/connection');

class Dispute {
  static async create(data) {
    const [dispute] = await db('disputes').insert(data).returning('*');
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
}

module.exports = Dispute;
