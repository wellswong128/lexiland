import { useLocale } from "../../features/locale/LocaleContext.jsx";

function CoinsStatCard({ value }) {
  const { t } = useLocale();

  return (
    <div className="home-card home-card-coins">
      <div className="home-stat-title">{t("rewards.lexicoinsLabel")}</div>
      <div className="home-stat-row">
        <span className="home-stat-value">{value}</span>
        <span aria-hidden="true" className="home-stat-emoji">
          🪙
        </span>
      </div>
    </div>
  );
}

export default CoinsStatCard;
