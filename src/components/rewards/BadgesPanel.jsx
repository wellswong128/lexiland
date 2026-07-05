import { Link } from "react-router-dom";
import { useLocale } from "../../features/locale/LocaleContext.jsx";

function BadgesPanel({ badges, compact = false, limit = null }) {
  const { t } = useLocale();
  const visibleBadges = limit ? badges.slice(0, limit) : badges;
  const earnedCount = badges.filter((badge) => badge.earned).length;

  return (
    <section
      aria-labelledby={compact ? "home-badges-title" : "badges-panel-title"}
      className={compact ? "rewards-badges rewards-badges-compact" : "rewards-badges"}
    >
      <div className="rewards-badges-header">
        <div>
          <p className="rewards-badges-badge">🏅 {t("rewards.badges.sectionBadge")}</p>
          <h2 className="rewards-badges-title" id={compact ? "home-badges-title" : "badges-panel-title"}>
            {t("rewards.badges.title")}
          </h2>
          <p className="rewards-badges-subtitle">
            {t("rewards.badges.summary", { earned: earnedCount, total: badges.length })}
          </p>
        </div>
        {compact ? (
          <Link className="rewards-badges-link" to="/achievements">
            {t("rewards.badges.viewAll")} ›
          </Link>
        ) : null}
      </div>

      <ul className="rewards-badges-grid">
        {visibleBadges.map((badge) => (
          <li
            className={[
              "rewards-badge-card",
              badge.earned ? "rewards-badge-card-earned" : "rewards-badge-card-locked",
            ].join(" ")}
            key={badge.id}
          >
            <span aria-hidden="true" className="rewards-badge-icon">
              {badge.icon}
            </span>
            <div className="rewards-badge-copy">
              <h3>{t(`rewards.badges.${badge.id}.name`)}</h3>
              <p>{t(`rewards.badges.${badge.id}.description`)}</p>
            </div>
            <span className="rewards-badge-status">
              {badge.earned ? t("rewards.badges.earned") : t("rewards.badges.locked")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default BadgesPanel;
