import { App } from "@capacitor/app";
import { Badge } from "@capawesome/capacitor-badge";
import { LocalNotifications } from "@capacitor/local-notifications";
import { isCapacitorNative } from "./platform.js";

export const LOCAL_NOTIFICATION_TEST_ID = 90001;
export const LOCAL_NOTIFICATION_TEST_BADGE = 1;
const TEST_DELAY_MS = 10_000;

let testBadgeListenerHandles = [];
let testNotificationActive = false;
let lifecycleInitialized = false;

function clearTestBadgeListeners() {
  testBadgeListenerHandles.forEach((handle) => {
    handle.remove();
  });
  testBadgeListenerHandles = [];
}

async function clearTestAppIconBadge() {
  if (!canUseLocalNotifications()) {
    return;
  }

  await Badge.clear();
}

async function finalizeTestNotification() {
  testNotificationActive = false;
  clearTestBadgeListeners();

  await LocalNotifications.removeDeliveredNotifications({
    notifications: [{ id: LOCAL_NOTIFICATION_TEST_ID }],
  });
  await clearTestAppIconBadge();
}

function registerTestBadgeListeners() {
  clearTestBadgeListeners();
  testNotificationActive = true;

  testBadgeListenerHandles.push(
    LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      if (event.notification?.id === LOCAL_NOTIFICATION_TEST_ID) {
        void finalizeTestNotification();
      }
    }),
  );
}

export function canUseLocalNotifications() {
  return isCapacitorNative();
}

export function initLocalNotificationTestLifecycle() {
  if (!canUseLocalNotifications() || lifecycleInitialized) {
    return;
  }

  lifecycleInitialized = true;

  void clearTestAppIconBadge();

  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive && testNotificationActive) {
      void finalizeTestNotification();
    }
  });
}

export async function getLocalNotificationPermissionStatus() {
  if (!canUseLocalNotifications()) {
    return "unsupported";
  }

  const result = await LocalNotifications.checkPermissions();
  return result.display ?? "prompt";
}

export async function ensureLocalNotificationPermission() {
  if (!canUseLocalNotifications()) {
    throw new Error("Local notifications are only available in the native app.");
  }

  const current = await LocalNotifications.checkPermissions();

  if (current.display === "granted") {
    return "granted";
  }

  const requested = await LocalNotifications.requestPermissions();
  return requested.display ?? "denied";
}

export async function scheduleLocalNotificationTest({ title, body, badge = LOCAL_NOTIFICATION_TEST_BADGE }) {
  if (!canUseLocalNotifications()) {
    throw new Error("Local notifications are only available in the native app.");
  }

  const permission = await ensureLocalNotificationPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  await cancelLocalNotificationTest();

  const fireAt = new Date(Date.now() + TEST_DELAY_MS);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: LOCAL_NOTIFICATION_TEST_ID,
        title,
        body,
        badge,
        schedule: { at: fireAt },
      },
    ],
  });

  registerTestBadgeListeners();

  return fireAt;
}

export async function cancelLocalNotificationTest() {
  if (!canUseLocalNotifications()) {
    return;
  }

  testNotificationActive = false;
  clearTestBadgeListeners();

  await LocalNotifications.cancel({
    notifications: [{ id: LOCAL_NOTIFICATION_TEST_ID }],
  });

  await LocalNotifications.removeDeliveredNotifications({
    notifications: [{ id: LOCAL_NOTIFICATION_TEST_ID }],
  });

  await clearTestAppIconBadge();
}
