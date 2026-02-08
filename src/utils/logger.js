const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level}] ${message} ${metaStr}`;
}

function log(level, message, meta) {
  if (LOG_LEVELS[level] >= currentLevel) {
    const formatted = formatMessage(level, message, meta);
    
    if (level === 'ERROR') {
      console.error(formatted);
    } else if (level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }
}

module.exports = {
  debug: (message, meta) => log('DEBUG', message, meta),
  info: (message, meta) => log('INFO', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  error: (message, meta) => log('ERROR', message, meta)
};
