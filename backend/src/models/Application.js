const db = require('../db/connection');

class Application {
  static async create(data) {
    const [application] = await db('applications').insert(data).returning('*');
    return application;
  }

  static async findById(id) {
    return db('applications').where({ id }).first();
  }

  // Existing application by this freelancer for this task (any status).
  static async findByTaskAndFreelancer(taskId, freelancerId) {
    return db('applications').where({ task_id: taskId, freelancer_id: freelancerId }).first();
  }

  // All applications for a task, with freelancer email.
  static async findByTask(taskId) {
    return db('applications')
      .join('users', 'users.id', 'applications.freelancer_id')
      .where('applications.task_id', taskId)
      .select(
        'applications.*',
        db.raw('users.email as freelancer_email')
      )
      .orderBy('applications.created_at', 'desc');
  }

  // A freelancer's own applications, joined with task info.
  static async findByFreelancer(freelancerId) {
    return db('applications')
      .join('tasks', 'tasks.id', 'applications.task_id')
      .join('users', 'users.id', 'tasks.client_id')
      .where('applications.freelancer_id', freelancerId)
      .select(
        'applications.*',
        db.raw('tasks.title as task_title'),
        db.raw('tasks.price as task_price'),
        db.raw('tasks.status as task_status'),
        db.raw('users.email as client_email')
      )
      .orderBy('applications.created_at', 'desc');
  }

  static async setStatus(id, status) {
    const [application] = await db('applications')
      .where({ id })
      .update({ status, updated_at: db.fn.now() })
      .returning('*');
    return application;
  }

  // Reject every other pending application on a task (after a hire).
  static async rejectOthers(taskId, exceptId) {
    return db('applications')
      .where({ task_id: taskId, status: 'pending' })
      .whereNot({ id: exceptId })
      .update({ status: 'rejected', updated_at: db.fn.now() });
  }
}

module.exports = Application;
