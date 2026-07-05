import { useEffect, useRef } from "react";
import { useLocale } from "../locale/LocaleContext.jsx";
import { subscribeToRewardUpdates } from "../rewards/rewardToasts.js";
import { buildReminderSnapshot } from "./buildReminderSnapshot.js";
import { syncDailySnapshot } from "./reminderApi.js";

const SYNC_DEBOUNCE_MS = 4_000;

export default function EveningReminderSync({ user, words }) {
  const { locale } = useLocale();
  const timeoutRef = useRef(null);
  const lastPayloadRef = useRef("");

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const scheduleSync = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(async () => {
        try {
          const snapshot = buildReminderSnapshot(words, locale);
          const payloadKey = JSON.stringify(snapshot);

          if (payloadKey === lastPayloadRef.current) {
            return;
          }

          await syncDailySnapshot(snapshot);
          lastPayloadRef.current = payloadKey;
        } catch (error) {
          console.warn("Could not sync evening reminder snapshot.", error);
        }
      }, SYNC_DEBOUNCE_MS);
    };

    scheduleSync();
    const unsubscribe = subscribeToRewardUpdates(scheduleSync);

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [locale, user?.id, words]);

  return null;
}
