import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSameOriginRedirectPath } from "../src/features/auth/redirectSafety.js";

test("keeps same-origin redirect paths", () => {
  assert.equal(normalizeSameOriginRedirectPath("/"), "/");
  assert.equal(normalizeSameOriginRedirectPath("/word-lookup?term=cat#results"), "/word-lookup?term=cat#results");
  assert.equal(normalizeSameOriginRedirectPath("  /settings  "), "/settings");
});

test("rejects external and protocol-relative redirects", () => {
  assert.equal(normalizeSameOriginRedirectPath("https://attacker.example/phish"), "/");
  assert.equal(normalizeSameOriginRedirectPath("javascript:alert(1)"), "/");
  assert.equal(normalizeSameOriginRedirectPath("//attacker.example/phish"), "/");
});

test("rejects decoded protocol-relative query values", () => {
  const params = new URLSearchParams("redirect=%2F%2Fattacker.example%2Fphish");

  assert.equal(normalizeSameOriginRedirectPath(params.get("redirect")), "/");
});

test("uses caller fallback for unsafe redirects", () => {
  assert.equal(normalizeSameOriginRedirectPath("//attacker.example/phish", "/home"), "/home");
  assert.equal(normalizeSameOriginRedirectPath("", "/home"), "/home");
});
