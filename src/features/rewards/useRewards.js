import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "../locale/LocaleContext.jsx";
import {
  checkAndAwardBadges,
  claimDailyHeroBonus,
  claimMissionReward,
  getBadgeViews,
  getDailyMissionSummary,
  getMissionViews,
} from "./rewardsEngine.js";
import { loadSyncedRewardState } from "./rewardExtensionsEngine.js";
import { subscribeToRewardUpdates } from "./rewardToasts.js";

export function useRewards(words = []) {
  const { t } = useLocale();
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    return subscribeToRewardUpdates(refresh);
  }, [refresh]);

  const state = useMemo(() => loadSyncedRewardState(), [version]);
  const missions = useMemo(() => getMissionViews(state), [state]);
  const badges = useMemo(() => getBadgeViews(state), [state]);
  const summary = useMemo(() => getDailyMissionSummary(state), [state]);

  const claimMission = useCallback(
    (missionId) => {
      claimMissionReward(missionId, { t });
      refresh();
    },
    [refresh, t],
  );

  const claimDailyHeroBonusAction = useCallback(() => {
    claimDailyHeroBonus({ t });
    refresh();
  }, [refresh, t]);

  const refreshBadges = useCallback(() => {
    checkAndAwardBadges(words, { t });
    refresh();
  }, [refresh, t, words]);

  return {
    allMissionsClaimed: summary.allMissionsClaimed,
    badges,
    claimDailyHeroBonus: claimDailyHeroBonusAction,
    claimMission,
    dailyHeroClaimable: summary.dailyHeroClaimable,
    dailyHeroClaimed: summary.dailyHeroClaimed,
    lexicoins: state.coins,
    missions,
    missionSummary: summary,
    refreshBadges,
    streak: state.currentStreak,
    streakSafeToday: summary.streakSafeToday,
    rewardState: state,
  };
}

export { awardLearningAction } from "./rewardsEngine.js";
