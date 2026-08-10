import assert from "node:assert/strict";
import test from "node:test";

import {
  getAnonymousWordsSaveAction,
  shouldSkipAnonymousSaveAfterSignOut,
} from "../src/features/words/anonymousWordsSaveGuard.js";

test("sign-out from a Supabase user suppresses the stale anonymous save once", () => {
  assert.equal(
    shouldSkipAnonymousSaveAfterSignOut({
      hasSupabaseConfig: true,
      lastAuthenticatedUserId: "user-a",
    }),
    true,
  );

  assert.deepEqual(
    getAnonymousWordsSaveAction({
      hasSupabaseConfig: true,
      hasUser: false,
      skipNextAnonymousSave: true,
    }),
    { shouldSave: false, shouldClearSkip: true },
  );

  assert.deepEqual(
    getAnonymousWordsSaveAction({
      hasSupabaseConfig: true,
      hasUser: false,
      skipNextAnonymousSave: false,
    }),
    { shouldSave: true, shouldClearSkip: false },
  );
});

test("normal anonymous mode still persists words", () => {
  assert.equal(
    shouldSkipAnonymousSaveAfterSignOut({
      hasSupabaseConfig: true,
      lastAuthenticatedUserId: null,
    }),
    false,
  );

  assert.deepEqual(
    getAnonymousWordsSaveAction({
      hasSupabaseConfig: false,
      hasUser: false,
      skipNextAnonymousSave: false,
    }),
    { shouldSave: true, shouldClearSkip: false },
  );
});

test("authenticated sessions do not use the anonymous words save path", () => {
  assert.deepEqual(
    getAnonymousWordsSaveAction({
      hasSupabaseConfig: true,
      hasUser: true,
      skipNextAnonymousSave: false,
    }),
    { shouldSave: false, shouldClearSkip: false },
  );
});
