import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "../locale/LocaleContext.jsx";
import {
  AVATAR_SHOP_CATEGORIES,
  AVATAR_SHOP_ITEMS,
  LEADERBOARD_CATEGORIES,
  TEAMS,
} from "./rewardExtensionDefinitions.js";
import {
  buyAvatarItem,
  claimEventMilestone,
  equipAvatarItem,
  getAvatarPreview,
  getChestViews,
  getLeaderboardEntries,
  getSeasonalEventView,
  getTeamProgress,
  isItemEquipped,
  joinTeam,
  loadSyncedRewardState,
  openMysteryChest,
  updateLeaderboardOptIn,
  updateSyncedRewardState,
} from "./rewardExtensionsEngine.js";
import { saveRewardState } from "./rewardsStore.js";
import { notifyRewardUpdate, subscribeToRewardUpdates } from "./rewardToasts.js";

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function useRewardExtensions() {
  const { t } = useLocale();
  const [version, setVersion] = useState(0);
  const [chestResult, setChestResult] = useState(null);

  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    return subscribeToRewardUpdates(refresh);
  }, [refresh]);

  const state = useMemo(() => loadSyncedRewardState(getDefaultStorage()), [version]);

  const avatarPreview = useMemo(() => getAvatarPreview(state), [state]);
  const teamProgress = useMemo(() => getTeamProgress(state), [state]);
  const seasonalEvent = useMemo(() => getSeasonalEventView(state), [state]);
  const availableChests = useMemo(() => getChestViews(state), [state]);
  const leaderboardEntries = useMemo(() => getLeaderboardEntries(state), [state]);

  const shopItems = useMemo(
    () =>
      AVATAR_SHOP_ITEMS.filter((item) => !item.eventOnly).map((item) => ({
        ...item,
        owned: state.avatar.ownedItemIds.includes(item.id),
        equipped: isItemEquipped(state, item.id),
      })),
    [state],
  );

  const persist = useCallback((nextState, storage = getDefaultStorage()) => {
    saveRewardState(nextState, storage);
    notifyRewardUpdate();
  }, []);

  const updatePersistedState = useCallback(
    (mutator) => {
      const storage = getDefaultStorage();
      const result = updateSyncedRewardState(mutator, { storage });

      if (result.success) {
        notifyRewardUpdate();
      }

      return result;
    },
    [],
  );

  const purchaseItem = useCallback(
    (itemId) => {
      return updatePersistedState((latestState) => buyAvatarItem(latestState, itemId, { t }));
    },
    [t, updatePersistedState],
  );

  const equipItem = useCallback(
    (itemId) => {
      return updatePersistedState((latestState) => equipAvatarItem(latestState, itemId, { t }));
    },
    [t, updatePersistedState],
  );

  const selectTeam = useCallback(
    (teamId) => {
      return updatePersistedState((latestState) => joinTeam(latestState, teamId, { t }));
    },
    [t, updatePersistedState],
  );

  const saveLeaderboardSettings = useCallback(
    ({ displayName, optIn }) => {
      const storage = getDefaultStorage();
      const latestState = loadSyncedRewardState(storage);
      persist(updateLeaderboardOptIn(latestState, { displayName, optIn }), storage);
    },
    [persist],
  );

  const openChest = useCallback(
    (chestId) => {
      const result = updatePersistedState((latestState) =>
        openMysteryChest(latestState, chestId, { t }),
      );

      if (result.success) {
        setChestResult(result.reward);
      }

      return result;
    },
    [t, updatePersistedState],
  );

  const claimMilestone = useCallback(
    (milestoneId) => {
      return updatePersistedState((latestState) =>
        claimEventMilestone(latestState, milestoneId, { t }),
      );
    },
    [t, updatePersistedState],
  );

  const clearChestResult = useCallback(() => {
    setChestResult(null);
  }, []);

  return {
    avatarPreview,
    availableChests,
    chestResult,
    claimMilestone,
    clearChestResult,
    equipItem,
    leaderboardCategories: LEADERBOARD_CATEGORIES,
    leaderboardEntries,
    lexicoins: state.coins,
    openChest,
    purchaseItem,
    rewardState: state,
    saveLeaderboardSettings,
    seasonalEvent,
    selectTeam,
    shopCategories: AVATAR_SHOP_CATEGORIES,
    shopItems,
    team: state.team,
    teamProgress,
    teams: TEAMS,
  };
}
