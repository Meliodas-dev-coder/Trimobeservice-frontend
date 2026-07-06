// Helpers for keeping list filters (search, category, page) in the URL query
// string, so filtered views survive the back button and can be shared.

export function queryInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// sameQuery compares only the given keys, treating missing and empty as equal.
export function sameQuery(a, b, keys) {
  return keys.every((key) => String(a?.[key] ?? '') === String(b?.[key] ?? ''));
}
