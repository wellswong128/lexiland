import { useLocale } from "../../features/locale/LocaleContext.jsx";

function TeamChallenge({ onJoinTeam, team, teamProgress, teams }) {
  const { t } = useLocale();
  const currentTeam = teams.find((entry) => entry.id === team.teamId);

  return (
    <section className="reward-center-panel">
      <header className="reward-center-panel-header">
        <div>
          <p className="reward-center-panel-badge">🤝 {t("rewards.center.team.badge")}</p>
          <h2 className="reward-center-panel-title">{t("rewards.center.team.title")}</h2>
          <p className="reward-center-panel-subtitle">{t("rewards.center.team.subtitle")}</p>
        </div>
      </header>

      {!currentTeam ? (
        <div className="reward-team-join">
          <p className="reward-team-join-copy">{t("rewards.center.team.joinPrompt")}</p>
          <ul className="reward-team-grid">
            {teams.map((entry) => (
              <li key={entry.id}>
                <button
                  className={`reward-team-card reward-team-card-${entry.color}`}
                  onClick={() => onJoinTeam(entry.id)}
                  type="button"
                >
                  <span aria-hidden="true" className="reward-team-card-icon">
                    {entry.icon}
                  </span>
                  <span className="reward-team-card-name">
                    {t(`rewards.center.team.teams.${entry.id}.name`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="reward-team-active">
          <div className={`reward-team-banner reward-team-banner-${currentTeam.color}`}>
            <span aria-hidden="true" className="reward-team-banner-icon">
              {currentTeam.icon}
            </span>
            <div>
              <p className="reward-team-banner-label">{t("rewards.center.team.yourTeam")}</p>
              <h3 className="reward-team-banner-name">
                {t(`rewards.center.team.teams.${currentTeam.id}.name`)}
              </h3>
            </div>
          </div>

          <div className="reward-team-progress">
            <div className="reward-team-progress-head">
              <span>{t("rewards.center.team.weeklyPoints")}</span>
              <strong>
                {teamProgress.points} / {teamProgress.goal}
              </strong>
            </div>
            <div className="reward-team-progress-bar">
              <span style={{ width: `${teamProgress.percent}%` }} />
            </div>
            <p className="reward-team-progress-note">{t("rewards.center.team.effortNote")}</p>
          </div>

          {teamProgress.helperEarned ? (
            <p className="reward-team-helper-earned">{t("rewards.center.team.helperEarned")}</p>
          ) : (
            <p className="reward-team-helper-hint">
              {t("rewards.center.team.helperHint", { points: teamProgress.helperThreshold })}
            </p>
          )}

          <p className="reward-team-demo-note">{t("rewards.center.team.demoNote")}</p>

          <details className="reward-team-switch">
            <summary>{t("rewards.center.team.changeTeam")}</summary>
            <ul className="reward-team-grid reward-team-grid-compact">
              {teams
                .filter((entry) => entry.id !== currentTeam.id)
                .map((entry) => (
                  <li key={entry.id}>
                    <button
                      className={`reward-team-card reward-team-card-${entry.color}`}
                      onClick={() => onJoinTeam(entry.id)}
                      type="button"
                    >
                      <span aria-hidden="true">{entry.icon}</span>
                      <span>{t(`rewards.center.team.teams.${entry.id}.name`)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}

export default TeamChallenge;
