exports.up = function (knex) {
    return knex.schema.table('nodes', function (table) {
        table.integer('position').defaultTo(0);
    });
};

exports.down = function (knex) {
    return knex.schema.table('nodes', function (table) {
        table.dropColumn('position');
    });
};
