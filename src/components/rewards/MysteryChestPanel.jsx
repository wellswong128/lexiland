import { useLocale } from "../../features/locale/LocaleContext.jsx";

function getChestLabelKey(chestId) {
  if (chestId.startsWith("streak_chest_")) {
    return "rewards.center.chests.streak";
  }

  return `rewards.center.chests.${chestId}`;
}

function MysteryChestPanel({ availableChests, chestResult, onClearResult, onOpenChest }) {
  const { t } = useLocale();

  return (
    <section className="reward-center-panel">
      <header className="reward-center-panel-header">
        <div>
          <p className="reward-center-panel-badge">🎁 {t("rewards.center.chests.badge")}</p>
          <h2 className="reward-center-panel-title">{t("rewards.center.chests.title")}</h2>
          <p className="reward-center-panel-subtitle">{t("rewards.center.chests.subtitle")}</p>
        </div>
      </header>

      {availableChests.length === 0 ? (
        <p className="reward-chest-empty">{t("rewards.center.chests.empty")}</p>
      ) : (
        <ul className="reward-chest-grid">
          {availableChests.map((chest) => (
            <li className="reward-chest-card" key={chest.id}>
              <span aria-hidden="true" className="reward-chest-card-icon">
                {chest.icon}
              </span>
              <h3 className="reward-chest-card-title">{t(getChestLabelKey(chest.id))}</h3>
              <button className="reward-chest-card-action" onClick={() => onOpenChest(chest.id)} type="button">
                {t("rewards.center.chests.open")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chestResult ? (
        <div className="reward-chest-result" role="dialog">
          <div className="reward-chest-result-card">
            <p className="reward-chest-result-title">{t("rewards.center.chests.resultTitle")}</p>
            <p className="reward-chest-result-copy">
              {chestResult.type === "coins"
                ? t("rewards.center.chests.foundCoins", { amount: chestResult.amount })
                : chestResult.type === "duplicate"
                  ? t("rewards.center.chests.duplicateCoins", { amount: chestResult.amount })
                  : t("rewards.center.chests.foundItem", {
                      item: t(`rewards.center.shop.items.${chestResult.itemId}.name`),
                    })}
            </p>
            <button className="reward-chest-result-close" onClick={onClearResult} type="button">
              {t("rewards.center.chests.close")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default MysteryChestPanel;
