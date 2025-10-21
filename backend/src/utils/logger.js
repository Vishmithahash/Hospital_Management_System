const dayjs = require('dayjs');

const LEVELS = ['debug', 'info', 'warn', 'error'];

function formatMessage(level, message, meta) {
  const timestamp = dayjs().toISOString();
  const payload = {
    level,
    timestamp,
    message
  };

  if (meta && Object.keys(meta).length > 0) {
    payload.meta = meta;
  }

  return JSON.stringify(payload);
}

function write(level, message, meta = {}) {
  if (!LEVELS.includes(level)) {
    level = 'info';
  }

  const line = formatMessage(level, message, meta);
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](line);
}

module.exports = {
  debug(message, meta) {
    write('debug', message, meta);
  },
  info(message, meta) {
    write('info', message, meta);
  },
  warn(message, meta) {
    write('warn', message, meta);
  },
  error(message, meta) {
    write('error', message, meta);
  },
  http(message, meta) {
    write('info', message, { ...meta, channel: 'http' });
  }
};
