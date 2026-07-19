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
import { applySyncedRewardMutation } from "./rewardExtensionMutations.js";
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
      return applySyncedRewardMutation(
        getDefaultStorage(),
        (currentState) => buyAvatarItem(currentState, itemId, { t }),
        persist,
      );
    },
    [persist, t],
  );

  const equipItem = useCallback(
    (itemId) => {
      return applySyncedRewardMutation(
        getDefaultStorage(),
        (currentState) => equipAvatarItem(currentState, itemId, { t }),
        persist,
      );
    },
    [persist, t],
  );

  const selectTeam = useCallback(
    (teamId) => {
      return applySyncedRewardMutation(
        getDefaultStorage(),
        (currentState) => joinTeam(currentState, teamId, { t }),
        persist,
      );
    },
    [persist, t],
  );

  const saveLeaderboardSettings = useCallback(
    ({ displayName, optIn }) => {
      const currentState = loadSyncedRewardState(getDefaultStorage());
      persist(updateLeaderboardOptIn(currentState, { displayName, optIn }));
    },
    [persist],
  );

  const openChest = useCallback(
    (chestId) => {
      const result = applySyncedRewardMutation(
        getDefaultStorage(),
        (currentState) => openMysteryChest(currentState, chestId, { t }),
        persist,
      );

      if (result.success) {
        setChestResult(result.reward);
      }

      return result;
    },
    [persist, t],
  );

  const claimMilestone = useCallback(
    (milestoneId) => {
      return applySyncedRewardMutation(
        getDefaultStorage(),
        (currentState) => claimEventMilestone(currentState, milestoneId, { t }),
        persist,
      );
    },
    [persist, t],
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
