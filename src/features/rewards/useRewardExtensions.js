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
} from "./rewardExtensionsEngine.js";
import { saveRewardState } from "./rewardsStore.js";
import { subscribeToRewardUpdates } from "./rewardToasts.js";

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function mutateLatestRewardState(storage, mutate) {
  const latestState = loadSyncedRewardState(storage);
  const result = mutate(latestState);

  if (result.success) {
    saveRewardState(result.state, storage);
  }

  return result;
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

  const persist = useCallback((nextState) => {
    saveRewardState(nextState, getDefaultStorage());
    refresh();
  }, [refresh]);

  const runLatestStateMutation = useCallback(
    (mutate) => {
      const result = mutateLatestRewardState(getDefaultStorage(), mutate);

      if (result.success) {
        refresh();
      }

      return result;
    },
    [refresh],
  );

  const purchaseItem = useCallback(
    (itemId) => {
      return runLatestStateMutation((latestState) =>
        buyAvatarItem(latestState, itemId, { t }),
      );
    },
    [runLatestStateMutation, t],
  );

  const equipItem = useCallback(
    (itemId) => {
      return runLatestStateMutation((latestState) =>
        equipAvatarItem(latestState, itemId, { t }),
      );
    },
    [runLatestStateMutation, t],
  );

  const selectTeam = useCallback(
    (teamId) => {
      return runLatestStateMutation((latestState) =>
        joinTeam(latestState, teamId, { t }),
      );
    },
    [runLatestStateMutation, t],
  );

  const saveLeaderboardSettings = useCallback(
    ({ displayName, optIn }) => {
      const latestState = loadSyncedRewardState(getDefaultStorage());
      persist(updateLeaderboardOptIn(latestState, { displayName, optIn }));
    },
    [persist],
  );

  const openChest = useCallback(
    (chestId) => {
      const result = runLatestStateMutation((latestState) =>
        openMysteryChest(latestState, chestId, { t }),
      );

      if (result.success) {
        setChestResult(result.reward);
      }

      return result;
    },
    [runLatestStateMutation, t],
  );

  const claimMilestone = useCallback(
    (milestoneId) => {
      return runLatestStateMutation((latestState) =>
        claimEventMilestone(latestState, milestoneId, { t }),
      );
    },
    [runLatestStateMutation, t],
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
