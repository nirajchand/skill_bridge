const db = require('../db/connection');
const { displayNameSql } = require('../utils/sql');

const PUBLIC_COLUMNS = [
  'tasks.id',
  'tasks.client_id',
  'tasks.title',
  'tasks.description',
  'tasks.category',
  'tasks.price',
  'tasks.status',
  'tasks.deadline',
  'tasks.skills_required',
  'tasks.created_at',
  'tasks.updated_at'
];

class Task {
  static async create(data) {
    const [task] = await db('tasks').insert(data).returning('*');
    return task;
  }

  // Browse open tasks with optional filters + applicant counts.
  static async browse({ category, minPrice, maxPrice, search, sort } = {}) {
    const query = db('tasks')
      .join('users', 'users.id', 'tasks.client_id')
      .leftJoin('applications', 'applications.task_id', 'tasks.id')
      .where('tasks.status', 'open')
      .whereNull('tasks.deleted_at')
      // Both columns feeding the client_name expression must be grouped, or
      // Postgres rejects the query ("must appear in the GROUP BY clause").
      .groupBy('tasks.id', 'users.display_name', 'users.email')
      .select(
        ...PUBLIC_COLUMNS,
        // Privacy: expose the poster's display name, never their email.
        db.raw(displayNameSql('users', 'client_name')),
        db.raw('count(applications.id)::int as applicant_count')
      );

    if (category) query.where('tasks.category', category);
    if (minPrice) query.where('tasks.price', '>=', minPrice);
    if (maxPrice) query.where('tasks.price', '<=', maxPrice);
    if (search) {
      query.where((b) =>
        b.whereILike('tasks.title', `%${search}%`).orWhereILike('tasks.description', `%${search}%`)
      );
    }

    switch (sort) {
      case 'price_high':
        query.orderBy('tasks.price', 'desc');
        break;
      case 'price_low':
        query.orderBy('tasks.price', 'asc');
        break;
      case 'applications':
        query.orderBy('applicant_count', 'desc');
        break;
      default:
        query.orderBy('tasks.created_at', 'desc');
    }

    return query;
  }

  // A client's own tasks with applicant counts.
  static async findByClient(clientId) {
    return db('tasks')
      .leftJoin('applications', 'applications.task_id', 'tasks.id')
      .where('tasks.client_id', clientId)
      .whereNull('tasks.deleted_at')
      .groupBy('tasks.id')
      .select(...PUBLIC_COLUMNS, db.raw('count(applications.id)::int as applicant_count'))
      .orderBy('tasks.created_at', 'desc');
  }

  static async findById(id) {
    return db('tasks')
      .join('users', 'users.id', 'tasks.client_id')
      .where('tasks.id', id)
      .whereNull('tasks.deleted_at')
      .select(...PUBLIC_COLUMNS, db.raw(displayNameSql('users', 'client_name')))
      .first();
  }

  static async findRawById(id) {
    return db('tasks').where({ id }).whereNull('deleted_at').first();
  }

  static async update(id, data, trx = db) {
    const [task] = await trx('tasks')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return task;
  }

  static async setStatus(id, status, trx = db) {
    return this.update(id, { status }, trx);
  }

  // Row-level lock (SELECT … FOR UPDATE). Used inside the hire transaction so two
  // concurrent "accept" requests on the same task serialise instead of racing —
  // without this, both could pass the status==='open' check and double-hire.
  static async lockById(id, trx) {
    return trx('tasks').where({ id }).whereNull('deleted_at').forUpdate().first();
  }

  static async softDelete(id) {
    return db('tasks').where({ id }).update({ deleted_at: db.fn.now(), status: 'cancelled' });
  }

  static async countByClient(clientId) {
    const rows = await db('tasks')
      .where('client_id', clientId)
      .whereNull('deleted_at')
      .select('status')
      .count('* as count')
      .groupBy('status');
    return rows.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {});
  }
}

module.exports = Task;
