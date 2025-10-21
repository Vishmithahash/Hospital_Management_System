function isEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return a === b;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((value, index) => isEqual(value, b[index]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every((key) => isEqual(a[key], b[key]));
  }

  return false;
}

function jsonDiff(before = {}, after = {}) {
  const diff = [];
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {})
  ]);

  for (const key of keys) {
    const previous = before ? before[key] : undefined;
    const current = after ? after[key] : undefined;

    if (!isEqual(previous, current)) {
      diff.push({
        path: key,
        before: previous,
        after: current
      });
    }
  }

  return diff;
}

module.exports = {
  jsonDiff
};
