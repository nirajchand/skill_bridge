/**
 * Marketplace core tables: tasks, applications, contracts, work_submissions, disputes.
 * Created in dependency order.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('tasks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('client_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index();
    t.string('title', 200).notNullable();
    t.text('description').notNullable();
    t.enum('category', ['writing', 'design', 'development', 'marketing', 'data', 'other']).notNullable();
    t.decimal('price', 10, 2).notNullable();
    t.enum('status', ['open', 'in_progress', 'completed', 'disputed', 'cancelled']).notNullable().defaultTo('open').index();
    t.timestamp('deadline').nullable();
    t.text('skills_required').nullable(); // comma-separated
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('applications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE').index();
    t.uuid('freelancer_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index();
    t.text('cover_letter').nullable();
    t.decimal('proposed_price', 10, 2).nullable();
    t.enum('status', ['pending', 'accepted', 'rejected', 'withdrawn']).notNullable().defaultTo('pending');
    t.timestamps(true, true);
    t.unique(['task_id', 'freelancer_id']);
  });

  await knex.schema.createTable('contracts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE').index();
    t.uuid('client_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index();
    t.uuid('freelancer_id').notNullable().references('id').inTable('users').onDelete('CASCADE').index();
    t.decimal('agreed_price', 10, 2).notNullable();
    t.enum('status', ['pending', 'funded', 'in_progress', 'submitted', 'completed', 'disputed', 'cancelled'])
      .notNullable()
      .defaultTo('pending');
    t.enum('escrow_status', ['not_funded', 'funded', 'released', 'refunded']).notNullable().defaultTo('not_funded');
    t.text('revision_notes').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('work_submissions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('contract_id').notNullable().references('id').inTable('contracts').onDelete('CASCADE').index();
    t.text('description').nullable();
    t.text('files_url').nullable(); // JSON array or newline/comma separated links
    t.enum('status', ['pending_review', 'approved', 'rejected', 'requested_revision']).notNullable().defaultTo('pending_review');
    t.timestamp('submitted_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('disputes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('contract_id').notNullable().references('id').inTable('contracts').onDelete('CASCADE').index();
    t.uuid('raised_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('reason').notNullable();
    t.text('description').nullable();
    t.enum('status', ['open', 'in_progress', 'resolved', 'escalated']).notNullable().defaultTo('open');
    t.text('resolution').nullable();
    t.timestamp('resolved_at').nullable();
    t.timestamps(true, true);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('disputes');
  await knex.schema.dropTableIfExists('work_submissions');
  await knex.schema.dropTableIfExists('contracts');
  await knex.schema.dropTableIfExists('applications');
  await knex.schema.dropTableIfExists('tasks');
};
