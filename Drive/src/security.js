export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

export function getRetryAfterSeconds(entry, now, windowMs) {
  if (!entry || now - entry.windowStart >= windowMs) return 0;
  if (entry.count < entry.limit) return 0;
  return Math.max(1, Math.ceil((windowMs - (now - entry.windowStart)) / 1000));
}

export function consumeRateLimit(map, key, {
  now = Date.now(),
  windowMs = 15 * 60 * 1000,
  limit = 5,
  maxKeys = 10_000,
} = {}) {
  let entry = map.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 0, windowStart: now, limit };
    map.set(key, entry);
  }

  const retryAfter = getRetryAfterSeconds(entry, now, windowMs);
  if (retryAfter) return { allowed: false, retryAfter };

  entry.count += 1;

  if (map.size > maxKeys) {
    for (const [candidate, value] of map) {
      if (now - value.windowStart >= windowMs) map.delete(candidate);
      if (map.size <= maxKeys) break;
    }
  }

  return { allowed: true, retryAfter: 0 };
}
