import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AvatarPreview from "../components/rewards/AvatarPreview.jsx";
import RewardCenter from "../components/rewards/RewardCenter.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useRewardExtensions } from "../features/rewards/useRewardExtensions.js";
import "../styles/reward-center.css";

const TABS = [
  { id: "avatar", icon: "🎨", labelKey: "rewards.center.tabs.avatar" },
  { id: "team", icon: "🤝", labelKey: "rewards.center.tabs.team" },
  { id: "leaderboard", icon: "🏅", labelKey: "rewards.center.tabs.leaderboard" },
  { id: "chests", icon: "🎁", labelKey: "rewards.center.tabs.chests" },
  { id: "events", icon: "🎉", labelKey: "rewards.center.tabs.events" },
];

function RewardCenterPage() {
  const { t } = useLocale();
  const extensions = useRewardExtensions();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "avatar";

  const tabItems = useMemo(
    () => TABS.filter((tab) => tab.id !== activeTab || true),
    [activeTab],
  );

  function selectTab(tabId) {
    setSearchParams({ tab: tabId });
  }

  return (
    <div className="reward-center-page">
      <header className="reward-center-page-header">
        <Link className="reward-center-back" to="/">
          ← {t("common.back")}
        </Link>
        <div className="reward-center-page-hero">
          <AvatarPreview preview={extensions.avatarPreview} size="lg" />
          <div>
            <p className="reward-center-page-badge">🎁 {t("rewards.center.badge")}</p>
            <h1 className="reward-center-page-title">{t("rewards.center.title")}</h1>
            <p className="reward-center-page-subtitle">{t("rewards.center.subtitle")}</p>
            <p className="reward-center-page-balance">
              {extensions.lexicoins} {t("rewards.lexicoinsLabel")}
            </p>
          </div>
        </div>
      </header>

      <nav aria-label={t("rewards.center.tabsLabel")} className="reward-center-page-tabs">
        {tabItems.map((tab) => (
          <button
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={[
              "reward-center-page-tab",
              activeTab === tab.id ? "reward-center-page-tab-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            type="button"
          >
            <span aria-hidden="true">{tab.icon}</span>
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <RewardCenter activeTab={activeTab} extensions={extensions} />
    </div>
  );
}

export default RewardCenterPage;
