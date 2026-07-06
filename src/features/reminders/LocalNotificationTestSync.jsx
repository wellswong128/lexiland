import { useEffect } from "react";
import { initLocalNotificationTestLifecycle } from "../../lib/localNotificationTest.js";

export default function LocalNotificationTestSync() {
  useEffect(() => {
    initLocalNotificationTestLifecycle();
  }, []);

  return null;
}
