exports.up = function (knex) {
    return knex.schema.table('nodes', table => {
        table.string('name').nullable();
    });
};

exports.down = function (knex) {
    return knex.schema.table('nodes', table => {
        table.dropColumn('name');
    });
};
