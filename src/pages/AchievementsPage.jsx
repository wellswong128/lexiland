import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import {
  ACHIEVEMENT_CATEGORIES,
  getAchievementsSummary,
  getNextAchievementGoal,
} from "../lib/achievements.js";
import { getLearningSnapshot } from "../lib/learningActivity.js";

const CATEGORY_ORDER = [
  ACHIEVEMENT_CATEGORIES.CONSISTENCY,
  ACHIEVEMENT_CATEGORIES.LEARNING,
  ACHIEVEMENT_CATEGORIES.GAMES,
];

function AchievementCard({ achievement, t }) {
  const progressPercent = Math.round(achievement.progress * 100);

  return (
    <article
      className={[
        "achievements-card",
        achievement.unlocked ? "achievements-card-unlocked" : "achievements-card-locked",
      ].join(" ")}
    >
      <div aria-hidden="true" className="achievements-card-emoji">
        {achievement.emoji}
      </div>
      <div className="achievements-card-body">
        <h3 className="achievements-card-title">{t(`achievements.badges.${achievement.id}.title`)}</h3>
        <p className="achievements-card-desc">{t(`achievements.badges.${achievement.id}.desc`)}</p>
        {!achievement.unlocked && achievement.target > 1 ? (
          <div className="achievements-card-progress">
            <div className="achievements-card-progress-bar">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="achievements-card-progress-label">
              {t("achievements.progress", {
                current: achievement.current,
                target: achievement.target,
              })}
            </span>
          </div>
        ) : null}
        {achievement.unlocked ? (
          <span className="achievements-card-badge">{t("achievements.unlocked")}</span>
        ) : achievement.target === 1 ? (
          <span className="achievements-card-badge achievements-card-badge-muted">
            {t("achievements.locked")}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function AchievementsPage() {
  const { t } = useLocale();
  const { words } = useWordsContext();
  const { streak } = getLearningSnapshot(words);
  const summary = useMemo(() => getAchievementsSummary(words), [words]);
  const nextGoal = useMemo(
    () => getNextAchievementGoal(summary.achievements),
    [summary.achievements],
  );

  const groupedAchievements = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: summary.achievements.filter((achievement) => achievement.category === category),
      })).filter((group) => group.items.length > 0),
    [summary.achievements],
  );

  return (
    <div className="achievements-page">
      <header className="achievements-hero">
        <div className="achievements-hero-top">
          <span aria-hidden="true" className="achievements-hero-icon">
            🏆
          </span>
          <div>
            <h1 className="achievements-title">{t("achievements.title")}</h1>
            <p className="achievements-summary">
              {t("achievements.summary", {
                unlocked: summary.unlockedCount,
                total: summary.totalCount,
              })}
            </p>
          </div>
        </div>

        <div className="achievements-streak-card">
          <div>
            <p className="achievements-streak-label">{t("home.streakLabel")}</p>
            <p className="achievements-streak-value">
              {streak}
              <span aria-hidden="true"> 🔥</span>
            </p>
          </div>
          {nextGoal ? (
            <div className="achievements-next-goal">
              <p className="achievements-next-label">{t("achievements.nextGoal")}</p>
              <p className="achievements-next-title">
                {nextGoal.emoji} {t(`achievements.badges.${nextGoal.id}.title`)}
              </p>
              <p className="achievements-next-progress">
                {t("achievements.progress", {
                  current: nextGoal.current,
                  target: nextGoal.target,
                })}
              </p>
            </div>
          ) : (
            <p className="achievements-all-done">{t("achievements.allUnlocked")}</p>
          )}
        </div>
        <Link className="achievements-secondary-link" to="/learning-report">
          {t("bottomNav.learningRecord")}
        </Link>
      </header>

      <div className="achievements-sections">
        {groupedAchievements.map((group) => (
          <section className="achievements-section" key={group.category}>
            <h2 className="achievements-section-title">
              {t(`achievements.categories.${group.category}`)}
            </h2>
            <div className="achievements-grid">
              {group.items.map((achievement) => (
                <AchievementCard achievement={achievement} key={achievement.id} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {summary.unlockedCount === 0 ? (
        <div className="achievements-empty">
          <p>{t("achievements.emptyHint")}</p>
          <Link className="achievements-empty-link" to="/">
            {t("common.home")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default AchievementsPage;
