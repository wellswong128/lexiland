import { useMemo, useState } from "react";
import { useLocale } from "../../features/locale/LocaleContext.jsx";
import AvatarPreview from "./AvatarPreview.jsx";

function getCategoryScore(entry, category) {
  if (category.useStateStreak) {
    return entry.scores.currentStreak;
  }

  if (category.id === "quizAccuracy") {
    return entry.scores.quizzesCompleted >= (category.minQuizzes ?? 2)
      ? entry.scores.quizAccuracy
      : null;
  }

  return entry.scores[category.scoreKey] ?? 0;
}

function ClassLeaderboard({
  entries,
  leaderboardCategories,
  onSaveSettings,
  rewardState,
}) {
  const { t } = useLocale();
  const [displayName, setDisplayName] = useState(rewardState.leaderboard.displayName);
  const [optIn, setOptIn] = useState(rewardState.leaderboard.optIn);
  const [activeCategoryId, setActiveCategoryId] = useState(leaderboardCategories[0].id);

  const activeCategory = leaderboardCategories.find((category) => category.id === activeCategoryId);

  const rankedEntries = useMemo(() => {
    if (!activeCategory) {
      return [];
    }

    return [...entries]
      .map((entry) => ({
        ...entry,
        score: getCategoryScore(entry, activeCategory),
      }))
      .filter((entry) => entry.score !== null)
      .sort((a, b) => b.score - a.score);
  }, [activeCategory, entries]);

  function handleSave(event) {
    event.preventDefault();
    onSaveSettings({ displayName, optIn });
  }

  return (
    <section className="reward-center-panel">
      <header className="reward-center-panel-header">
        <div>
          <p className="reward-center-panel-badge">🏅 {t("rewards.center.leaderboard.badge")}</p>
          <h2 className="reward-center-panel-title">{t("rewards.center.leaderboard.title")}</h2>
          <p className="reward-center-panel-subtitle">{t("rewards.center.leaderboard.subtitle")}</p>
        </div>
      </header>

      <form className="reward-leaderboard-optin" onSubmit={handleSave}>
        <label className="reward-leaderboard-label" htmlFor="leaderboard-nickname">
          {t("rewards.center.leaderboard.nicknameLabel")}
        </label>
        <input
          className="reward-leaderboard-input"
          id="leaderboard-nickname"
          maxLength={24}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={t("rewards.center.leaderboard.nicknamePlaceholder")}
          value={displayName}
        />
        <label className="reward-leaderboard-checkbox">
          <input checked={optIn} onChange={(event) => setOptIn(event.target.checked)} type="checkbox" />
          <span>{t("rewards.center.leaderboard.optIn")}</span>
        </label>
        <button className="reward-leaderboard-save" type="submit">
          {t("rewards.center.leaderboard.save")}
        </button>
      </form>

      {!optIn || !displayName.trim() ? (
        <p className="reward-leaderboard-empty">{t("rewards.center.leaderboard.joinPrompt")}</p>
      ) : (
        <>
          <div className="reward-center-tabs" role="tablist">
            {leaderboardCategories.map((category) => (
              <button
                aria-selected={activeCategoryId === category.id}
                className={[
                  "reward-center-tab",
                  activeCategoryId === category.id ? "reward-center-tab-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={category.id}
                onClick={() => setActiveCategoryId(category.id)}
                role="tab"
                type="button"
              >
                {t(`rewards.center.leaderboard.categories.${category.id}`)}
              </button>
            ))}
          </div>

          {activeCategory?.id === "quizAccuracy" &&
          rankedEntries.length === 0 &&
          entries[0]?.scores.quizzesCompleted < 2 ? (
            <p className="reward-leaderboard-empty">
              {t("rewards.center.leaderboard.quizMinimum")}
            </p>
          ) : (
            <ol className="reward-leaderboard-list">
              {rankedEntries.map((entry, index) => (
                <li
                  className={[
                    "reward-leaderboard-item",
                    entry.isCurrentUser ? "reward-leaderboard-item-current" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={entry.userId}
                >
                  <span className="reward-leaderboard-rank">#{index + 1}</span>
                  <AvatarPreview preview={entry.avatar} size="sm" />
                  <div className="reward-leaderboard-copy">
                    <strong>{entry.displayName}</strong>
                    <span>
                      {activeCategory.id === "quizAccuracy"
                        ? `${entry.score}%`
                        : entry.score}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <p className="reward-leaderboard-note">{t("rewards.center.leaderboard.resetNote")}</p>
      <p className="reward-leaderboard-note">{t("rewards.center.leaderboard.demoNote")}</p>
    </section>
  );
}

export default ClassLeaderboard;
