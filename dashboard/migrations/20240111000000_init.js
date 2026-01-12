exports.up = function (knex) {
    return knex.schema
        .createTable('nodes', table => {
            table.string('id').primary();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.timestamp('last_seen').defaultTo(knex.fn.now());

            table.string('location').defaultTo('Unknown');
            table.string('isp').defaultTo('Unknown');

            table.integer('cores').defaultTo(0);
            table.float('load_1').defaultTo(0);
            table.float('load_5').defaultTo(0);
            table.float('load_15').defaultTo(0);

            table.bigInteger('mem_used').defaultTo(0);
            table.bigInteger('mem_total').defaultTo(0);
            table.bigInteger('disk_used').defaultTo(0);
            table.bigInteger('disk_total').defaultTo(0);

            table.float('cpu_steal').defaultTo(0);
            table.float('net_up').defaultTo(0);
            table.float('net_down').defaultTo(0);

            // Static Info
            table.string('host_name');
            table.string('os_distro');
            table.string('kernel_version');
            table.string('cpu_model');
            table.string('cpu_cores_detail');
            table.bigInteger('boot_time');
            table.string('public_ip');
        })
        .createTable('history', table => {
            table.increments('id');
            table.string('node_id').index();
            table.timestamp('timestamp');

            table.float('load_1');
            table.float('mem_percent');
            table.float('disk_percent');
            table.float('net_in');
            table.float('net_out');

            table.index(['node_id', 'timestamp']);
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('history')
        .dropTableIfExists('nodes');
};
