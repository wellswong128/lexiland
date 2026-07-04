import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAuthRedirectPath } from "../src/features/auth/safeRedirect.js";

test("normalizes missing or external auth redirects to the root path", () => {
  assert.equal(normalizeAuthRedirectPath(null), "/");
  assert.equal(normalizeAuthRedirectPath(""), "/");
  assert.equal(normalizeAuthRedirectPath("https://attacker.example/phish"), "/");
  assert.equal(normalizeAuthRedirectPath("//attacker.example/phish"), "/");
  assert.equal(normalizeAuthRedirectPath("///attacker.example/phish"), "/");
});

test("preserves normal same-app auth redirect paths", () => {
  assert.equal(normalizeAuthRedirectPath("/"), "/");
  assert.equal(normalizeAuthRedirectPath("/words"), "/words");
  assert.equal(
    normalizeAuthRedirectPath("/words/lookup?term=apple#examples"),
    "/words/lookup?term=apple#examples",
  );
});

test("uses a safe fallback when the requested redirect is unsafe", () => {
  assert.equal(
    normalizeAuthRedirectPath("//attacker.example/phish", "/settings"),
    "/settings",
  );
  assert.equal(normalizeAuthRedirectPath("//attacker.example/phish", ""), "");
  assert.equal(
    normalizeAuthRedirectPath("//attacker.example/phish", "https://attacker.example"),
    "/",
  );
});
