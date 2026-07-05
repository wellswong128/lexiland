import { Link } from "react-router-dom";
import { useLocale } from "../../features/locale/LocaleContext.jsx";

function TodayMissions({
  allMissionsClaimed,
  claimDailyHeroBonus,
  claimMission,
  dailyHeroClaimable,
  dailyHeroClaimed,
  missions,
  streakSafeToday,
}) {
  const { t } = useLocale();
  const completedCount = missions.filter((mission) => mission.completed).length;

  return (
    <section aria-labelledby="today-missions-title" className="rewards-missions">
      <div className="rewards-missions-header">
        <div>
          <p className="rewards-missions-badge">✨ {t("rewards.missions.badge")}</p>
          <h2 className="rewards-missions-title" id="today-missions-title">
            {t("rewards.missions.title")}
          </h2>
          <p className="rewards-missions-subtitle">{t("rewards.missions.subtitle")}</p>
        </div>
        <p className="rewards-missions-summary">
          {t("rewards.missions.summary", {
            completed: completedCount,
            total: missions.length,
          })}
        </p>
      </div>

      <p className="rewards-missions-streak-note">
        {streakSafeToday ? t("rewards.missions.streakSafe") : t("rewards.missions.streakHint")}
      </p>

      <ul className="rewards-missions-list">
        {missions.map((mission) => {
          const isClaimable = mission.completed && !mission.claimed;

          return (
            <li className="rewards-mission-item" key={mission.id}>
              <div className="rewards-mission-main">
                <span
                  aria-hidden="true"
                  className={[
                    "rewards-mission-check",
                    mission.completed ? "rewards-mission-check-done" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {mission.completed ? "✓" : "□"}
                </span>
                <div className="rewards-mission-copy">
                  <span className="rewards-mission-emoji" aria-hidden="true">
                    {mission.emoji}
                  </span>
                  <Link className="rewards-mission-title" to={mission.to}>
                    {t(`rewards.missions.items.${mission.id}.title`, {
                      target: mission.target,
                    })}
                  </Link>
                </div>
              </div>
              <div className="rewards-mission-meta">
                <span className="rewards-mission-progress">
                  {t("rewards.missions.progress", {
                    current: mission.progress,
                    target: mission.target,
                  })}
                </span>
                <span className="rewards-mission-reward">
                  +{mission.rewardCoins} {t("rewards.coinsShort")}
                </span>
                {isClaimable ? (
                  <button
                    className="rewards-mission-claim"
                    onClick={() => claimMission(mission.id)}
                    type="button"
                  >
                    {t("rewards.missions.claim")}
                  </button>
                ) : mission.claimed ? (
                  <span className="rewards-mission-claimed">{t("rewards.missions.claimed")}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rewards-missions-bonus">
        <p>{t("rewards.missions.heroBonusHint")}</p>
        {dailyHeroClaimable ? (
          <button
            className="rewards-missions-hero-claim"
            onClick={claimDailyHeroBonus}
            type="button"
          >
            {t("rewards.missions.claimHeroBonus")}
          </button>
        ) : dailyHeroClaimed || allMissionsClaimed ? (
          <span className="rewards-missions-hero-done">{t("rewards.missions.heroBonusDone")}</span>
        ) : null}
      </div>
    </section>
  );
}

export default TodayMissions;
