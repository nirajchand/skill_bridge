const db = require('../db/connection');

class Contract {
  static async create(data) {
    const [contract] = await db('contracts').insert(data).returning('*');
    return contract;
  }

  static async findRawById(id) {
    return db('contracts').where({ id }).first();
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
        db.raw('client.email as client_email'),
        db.raw('freelancer.email as freelancer_email')
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
        db.raw('client.email as client_email'),
        db.raw('freelancer.email as freelancer_email')
      )
      .orderBy('contracts.created_at', 'desc');
  }

  static async update(id, data) {
    const [contract] = await db('contracts')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return contract;
  }
}

module.exports = Contract;
