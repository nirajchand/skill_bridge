const db = require('../db/connection');

class WorkSubmission {
  static async create(data, trx = db) {
    const [submission] = await trx('work_submissions').insert(data).returning('*');
    return submission;
  }

  static async findByContract(contractId) {
    return db('work_submissions')
      .where({ contract_id: contractId })
      .orderBy('submitted_at', 'desc');
  }

  static async setStatus(id, status, trx = db) {
    const [submission] = await trx('work_submissions').where({ id }).update({ status }).returning('*');
    return submission;
  }
}

module.exports = WorkSubmission;
