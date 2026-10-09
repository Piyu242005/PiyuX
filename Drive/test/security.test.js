import test from "node:test";
import assert from "node:assert/strict";
import { validatePassword, consumeRateLimit } from "../src/security.js";

test("password policy rejects short or missing passwords", () => {
  assert.equal(validatePassword("short"), false);
  assert.equal(validatePassword(""), false);
  assert.equal(validatePassword(undefined), false);
  assert.equal(validatePassword("correct horse battery"), true);
});

test("login limiter allows five attempts and blocks the sixth within window", () => {
  const map = new Map();
  const options = { now: 1_000, windowMs: 60_000, limit: 5, maxKeys: 100 };
  for (let i = 0; i < 5; i++) {
    assert.equal(consumeRateLimit(map, "127.0.0.1", options).allowed, true);
  }
  const blocked = consumeRateLimit(map, "127.0.0.1", options);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 60);
});

test("login limiter resets once the time window expires", () => {
  const map = new Map();
  const base = { windowMs: 60_000, limit: 1, maxKeys: 100 };
  assert.equal(consumeRateLimit(map, "client", { ...base, now: 100 }).allowed, true);
  assert.equal(consumeRateLimit(map, "client", { ...base, now: 101 }).allowed, false);
  assert.equal(consumeRateLimit(map, "client", { ...base, now: 60_100 }).allowed, true);
});

test("login limiter bounds tracked client keys", () => {
  const map = new Map();
  consumeRateLimit(map, "a", { now: 0, windowMs: 1, limit: 1, maxKeys: 1 });
  consumeRateLimit(map, "b", { now: 10, windowMs: 1, limit: 1, maxKeys: 1 });
  assert.ok(map.size <= 1);
});
