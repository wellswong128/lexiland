import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function importLocalNotificationTestWithMocks(state) {
  globalThis.__localNotificationTestMockState = state;

  const source = await readFile(new URL("../src/lib/localNotificationTest.js", import.meta.url), "utf8");
  const mockedSource = `
const {
  App,
  Badge,
  LocalNotifications,
  isCapacitorNative,
} = globalThis.__localNotificationTestMockState;
${source.replace(/^import .*;\n/gm, "")}
`;

  return import(`data:text/javascript;base64,${Buffer.from(mockedSource).toString("base64")}#${Date.now()}`);
}

test("canceling a scheduled local notification test removes promised listener handles", async () => {
  let resolveListenerHandle;
  let listenerRemoved = false;

  const listenerHandlePromise = new Promise((resolve) => {
    resolveListenerHandle = () => {
      resolve({
        remove() {
          listenerRemoved = true;
        },
      });
    };
  });

  const module = await importLocalNotificationTestWithMocks({
    App: {
      addListener() {
        return Promise.resolve({ remove() {} });
      },
    },
    Badge: {
      async clear() {},
    },
    LocalNotifications: {
      addListener() {
        return listenerHandlePromise;
      },
      async cancel() {},
      async checkPermissions() {
        return { display: "granted" };
      },
      async removeDeliveredNotifications() {},
      async requestPermissions() {
        return { display: "granted" };
      },
      async schedule() {},
    },
    isCapacitorNative() {
      return true;
    },
  });

  await module.scheduleLocalNotificationTest({ title: "Test", body: "Body" });
  await module.cancelLocalNotificationTest();

  assert.equal(listenerRemoved, false);
  resolveListenerHandle();
  await listenerHandlePromise;
  await Promise.resolve();

  assert.equal(listenerRemoved, true);
});
