exports.up = function up(knex) {
  return knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto').then(() =>
    knex.schema.createTable('users', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('email').unique().notNullable().index();
      table.string('password_hash').notNullable();
      table.enum('role', ['client', 'freelancer']).notNullable();
      table.boolean('is_verified').defaultTo(false);
      table.integer('failed_login_attempts').defaultTo(0);
      table.timestamp('locked_until').nullable();
      table.timestamp('last_login_at').nullable();
      table.string('last_login_ip').nullable();
      table.timestamps(true, true);
    })
  );
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('users');
};
