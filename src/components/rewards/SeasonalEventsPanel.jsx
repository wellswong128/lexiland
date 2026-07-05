import { useLocale } from "../../features/locale/LocaleContext.jsx";

function SeasonalEventsPanel({ onClaimMilestone, seasonalEvent }) {
  const { t } = useLocale();

  if (!seasonalEvent) {
    return (
      <section className="reward-center-panel">
        <header className="reward-center-panel-header">
          <div>
            <p className="reward-center-panel-badge">🎉 {t("rewards.center.events.badge")}</p>
            <h2 className="reward-center-panel-title">{t("rewards.center.events.title")}</h2>
          </div>
        </header>
        <p className="reward-event-empty">{t("rewards.center.events.noActive")}</p>
      </section>
    );
  }

  const progressPercent = Math.min(
    100,
    Math.round((seasonalEvent.progress / seasonalEvent.goal) * 100),
  );

  return (
    <section className="reward-center-panel">
      <header className="reward-center-panel-header">
        <div>
          <p className="reward-center-panel-badge">
            {seasonalEvent.theme} {t("rewards.center.events.badge")}
          </p>
          <h2 className="reward-center-panel-title">
            {t(`rewards.center.events.items.${seasonalEvent.id}.title`)}
          </h2>
          <p className="reward-center-panel-subtitle">
            {t(`rewards.center.events.items.${seasonalEvent.id}.description`)}
          </p>
        </div>
      </header>

      <div className="reward-event-progress">
        <div className="reward-event-progress-head">
          <span>{t("rewards.center.events.progress")}</span>
          <strong>
            {seasonalEvent.progress} / {seasonalEvent.goal}
          </strong>
        </div>
        <div className="reward-event-progress-bar">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <ul className="reward-event-milestones">
        {seasonalEvent.milestones.map((milestone) => (
          <li className="reward-event-milestone" key={milestone.id}>
            <div>
              <strong>{t(`rewards.center.events.milestones.${milestone.id}.title`)}</strong>
              <p>{t(`rewards.center.events.milestones.${milestone.id}.reward`)}</p>
            </div>
            {milestone.claimed ? (
              <span className="reward-event-milestone-claimed">
                {t("rewards.center.events.claimed")}
              </span>
            ) : milestone.ready ? (
              <button
                className="reward-event-milestone-claim"
                onClick={() => onClaimMilestone(milestone.id)}
                type="button"
              >
                {t("rewards.center.events.claim")}
              </button>
            ) : (
              <span className="reward-event-milestone-locked">
                {t("rewards.center.events.locked")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SeasonalEventsPanel;
