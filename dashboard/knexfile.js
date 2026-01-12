const path = require('path');

module.exports = {
    development: {
        client: 'better-sqlite3',
        connection: {
            filename: process.env.DB_PATH || path.join(__dirname, 'kiloa.db')
        },
        useNullAsDefault: true
    },
    production: {
        client: 'pg',
        connection: process.env.DATABASE_URL,
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            tableName: 'knex_migrations'
        }
    }
};
