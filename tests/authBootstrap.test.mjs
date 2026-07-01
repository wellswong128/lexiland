import assert from "node:assert/strict";
import test from "node:test";
import {
  getSafeAuthRedirectPath,
  navigateAfterPersistedSession,
  waitForPersistedSession,
} from "../src/features/auth/authBootstrap.js";

test("getSafeAuthRedirectPath keeps in-app redirects", () => {
  assert.equal(getSafeAuthRedirectPath("/words?mode=review#today"), "/words?mode=review#today");
});

test("getSafeAuthRedirectPath rejects external or malformed redirects", () => {
  assert.equal(getSafeAuthRedirectPath("//evil.example/login"), "/");
  assert.equal(getSafeAuthRedirectPath("/\\evil.example/login"), "/");
  assert.equal(getSafeAuthRedirectPath("https://evil.example/login"), "/");
  assert.equal(getSafeAuthRedirectPath("words"), "/");
  assert.equal(getSafeAuthRedirectPath(null), "/");
});

test("waitForPersistedSession polls until a session is readable", async () => {
  const session = { access_token: "persisted" };
  let calls = 0;
  const authClient = {
    async getSession() {
      calls += 1;
      return calls < 3 ? { data: { session: null } } : { data: { session } };
    },
  };

  assert.equal(
    await waitForPersistedSession({ attempts: 4, delayMs: 0, authClient }),
    session,
  );
  assert.equal(calls, 3);
});

test("navigateAfterPersistedSession waits before hard navigating", async () => {
  const originalWindow = globalThis.window;
  const replacedPaths = [];
  let calls = 0;
  const authClient = {
    async getSession() {
      calls += 1;
      assert.deepEqual(replacedPaths, []);
      return calls < 2
        ? { data: { session: null } }
        : { data: { session: { access_token: "persisted" } } };
    },
  };

  globalThis.window = {
    location: {
      replace(path) {
        replacedPaths.push(path);
      },
    },
    setTimeout: globalThis.setTimeout,
  };

  try {
    assert.equal(
      await navigateAfterPersistedSession("//evil.example/login", {
        attempts: 3,
        delayMs: 0,
        authClient,
      }),
      true,
    );
  } finally {
    globalThis.window = originalWindow;
  }

  assert.deepEqual(replacedPaths, ["/"]);
});

test("navigateAfterPersistedSession does not navigate without a readable session", async () => {
  const originalWindow = globalThis.window;
  const replacedPaths = [];
  const authClient = {
    async getSession() {
      return { data: { session: null } };
    },
  };

  globalThis.window = {
    location: {
      replace(path) {
        replacedPaths.push(path);
      },
    },
    setTimeout: globalThis.setTimeout,
  };

  try {
    assert.equal(
      await navigateAfterPersistedSession("/words", {
        attempts: 2,
        delayMs: 0,
        authClient,
      }),
      false,
    );
  } finally {
    globalThis.window = originalWindow;
  }

  assert.deepEqual(replacedPaths, []);
});
