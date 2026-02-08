require('dotenv').config();
const { initDatabase } = require('./init');
const logger = require('../utils/logger');

async function migrate() {
  try {
    logger.info('Starting database migration...');
    await initDatabase();
    logger.info('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
