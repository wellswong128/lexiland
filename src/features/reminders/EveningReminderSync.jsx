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
  const activeUserIdRef = useRef("");

  useEffect(() => {
    activeUserIdRef.current = user?.id || "";
    lastPayloadRef.current = "";
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const syncUserId = user.id;

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

          if (activeUserIdRef.current !== syncUserId) {
            return;
          }

          await syncDailySnapshot(snapshot, { userId: syncUserId });

          if (activeUserIdRef.current === syncUserId) {
            lastPayloadRef.current = payloadKey;
          }
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
