const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const store = new Map();

function keyOf(payload) {
  return JSON.stringify(payload);
}

function get(payload) {
  const key = keyOf(payload);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(payload, value, ttlMs = CACHE_TTL_MS) {
  const key = keyOf(payload);
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

module.exports = { get, set };

