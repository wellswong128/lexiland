import { useMemo } from "react";
import { useLocale } from "../../features/locale/LocaleContext.jsx";
import { getWeeklyRewardSummary } from "../../features/rewards/rewardsEngine.js";
import { loadRewardState } from "../../features/rewards/rewardsStore.js";

function WeeklyRewardReport({ words = [] }) {
  const { t } = useLocale();
  const summary = useMemo(() => {
    const state = loadRewardState();
    return getWeeklyRewardSummary(state, words);
  }, [words]);

  const badgeNames = summary.badgesEarned
    .map((badgeId) => t(`rewards.badges.${badgeId}.name`))
    .join(", ");

  return (
    <section aria-labelledby="weekly-reward-report-title" className="rewards-weekly-report">
      <div className="rewards-weekly-report-header">
        <p className="rewards-weekly-report-badge">{t("rewards.weekly.badge")}</p>
        <h2 className="rewards-weekly-report-title" id="weekly-reward-report-title">
          {t("rewards.weekly.title")}
        </h2>
        <p className="rewards-weekly-report-intro">
          {t("rewards.weekly.intro", { days: summary.activeDays })}
        </p>
      </div>

      <dl className="rewards-weekly-report-stats">
        <div>
          <dt>{t("rewards.weekly.activeDays")}</dt>
          <dd>{summary.activeDays}</dd>
        </div>
        <div>
          <dt>{t("rewards.weekly.currentStreak")}</dt>
          <dd>{summary.currentStreak}</dd>
        </div>
        <div>
          <dt>{t("rewards.weekly.longestStreak")}</dt>
          <dd>{summary.longestStreak}</dd>
        </div>
        <div>
          <dt>{t("rewards.weekly.wordsAdded")}</dt>
          <dd>{summary.wordsAdded}</dd>
        </div>
        <div>
          <dt>{t("rewards.weekly.wordsReviewed")}</dt>
          <dd>{summary.wordsReviewed}</dd>
        </div>
        <div>
          <dt>{t("rewards.weekly.quizzesCompleted")}</dt>
          <dd>{summary.quizzesCompleted}</dd>
        </div>
        <div>
          <dt>{t("rewards.weekly.gamesPlayed")}</dt>
          <dd>{summary.gamesPlayed}</dd>
        </div>
        <div>
          <dt>{t("rewards.weekly.mistakesFixed")}</dt>
          <dd>{summary.mistakesFixed}</dd>
        </div>
        <div>
          <dt>{t("rewards.weekly.coinsEarned")}</dt>
          <dd>{summary.coinsEarned}</dd>
        </div>
        <div className="rewards-weekly-report-badges">
          <dt>{t("rewards.weekly.badgesEarned")}</dt>
          <dd>{badgeNames || t("rewards.weekly.noBadgesYet")}</dd>
        </div>
      </dl>

      <div className="rewards-weekly-report-tip">
        <p className="rewards-weekly-report-tip-label">{t("rewards.weekly.tipLabel")}</p>
        <p>{t(`rewards.weekly.tips.${summary.suggestedFocus}`)}</p>
      </div>
    </section>
  );
}

export default WeeklyRewardReport;
