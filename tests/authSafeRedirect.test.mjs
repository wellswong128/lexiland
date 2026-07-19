import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeInAppRedirect } from "../src/features/auth/safeRedirect.js";

test("normalizeInAppRedirect accepts only same-origin relative redirects", () => {
  assert.equal(normalizeInAppRedirect("/review/flashcards"), "/review/flashcards");
  assert.equal(normalizeInAppRedirect("/admin/wordbase?tab=missing"), "/admin/wordbase?tab=missing");
  assert.equal(normalizeInAppRedirect("https://attacker.example/path"), "/");
  assert.equal(normalizeInAppRedirect("//attacker.example/path"), "/");
  assert.equal(normalizeInAppRedirect(""), "/");
});

test("normalizeInAppRedirect supports explicit fallback", () => {
  assert.equal(normalizeInAppRedirect("//attacker.example/path", "/words"), "/words");
});
