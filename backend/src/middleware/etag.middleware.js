function parseVersion(value) {
  if (typeof value === 'undefined' || value === null) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  const cleaned = String(value).replace(/"/g, '').trim();
  const parsed = Number.parseInt(cleaned, 10);

  return Number.isNaN(parsed) ? undefined : parsed;
}

function etagMiddleware(req, res, next) {
  const ifMatch = req.headers['if-match'];
  const fromHeader = parseVersion(ifMatch);
  const fromBody = req.body ? parseVersion(req.body.version) : undefined;

  req.expectedVersion = typeof fromHeader !== 'undefined' ? fromHeader : fromBody;

  next();
}

module.exports = etagMiddleware;
