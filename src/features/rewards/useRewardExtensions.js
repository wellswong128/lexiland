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

  const purchaseItem = useCallback(
    (itemId) => {
      const result = buyAvatarItem(state, itemId, { t });

      if (result.success) {
        persist(result.state);
      }

      return result;
    },
    [persist, state, t],
  );

  const equipItem = useCallback(
    (itemId) => {
      const result = equipAvatarItem(state, itemId, { t });

      if (result.success) {
        persist(result.state);
      }

      return result;
    },
    [persist, state, t],
  );

  const selectTeam = useCallback(
    (teamId) => {
      const result = joinTeam(state, teamId, { t });

      if (result.success) {
        persist(result.state);
      }

      return result;
    },
    [persist, state, t],
  );

  const saveLeaderboardSettings = useCallback(
    ({ displayName, optIn }) => {
      persist(updateLeaderboardOptIn(state, { displayName, optIn }));
    },
    [persist, state],
  );

  const openChest = useCallback(
    (chestId) => {
      const result = openMysteryChest(state, chestId, { t });

      if (result.success) {
        persist(result.state);
        setChestResult(result.reward);
      }

      return result;
    },
    [persist, state, t],
  );

  const claimMilestone = useCallback(
    (milestoneId) => {
      const result = claimEventMilestone(state, milestoneId, { t });

      if (result.success) {
        persist(result.state);
      }

      return result;
    },
    [persist, state, t],
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
