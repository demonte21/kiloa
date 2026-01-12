const knexConfig = require('./knexfile');
const environment = process.env.NODE_ENV || 'development';
const knex = require('knex')(knexConfig[environment]);

// Run migrations on startup
async function init() {
  try {
    console.log('Checking database migrations...');
    await knex.migrate.latest();
    console.log('Database migrations are up to date.');
  } catch (err) {
    console.error('Error running migrations:', err);
  }
}

init();

module.exports = knex;
