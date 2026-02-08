const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

let pool;

async function initDatabase() {
  pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Проверка подключения
  try {
    await pool.query('SELECT NOW()');
    logger.info('Database connected successfully');
    
    // Выполнение миграций
    await runMigrations();
  } catch (error) {
    logger.error('Database connection error:', error);
    throw error;
  }

  return pool;
}

async function runMigrations() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    await pool.query(schema);
    logger.info('Migrations completed successfully');
  } catch (error) {
    logger.error('Migration error:', error);
    throw error;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
}

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error', { text, error: error.message });
    throw error;
  }
}

module.exports = {
  initDatabase,
  getPool,
  query
};
