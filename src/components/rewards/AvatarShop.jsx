import { useMemo, useState } from "react";
import { useLocale } from "../../features/locale/LocaleContext.jsx";

function AvatarShop({ lexicoins, onBuy, onEquip, shopCategories, shopItems }) {
  const { t } = useLocale();
  const categories = useMemo(
    () => [
      { id: shopCategories.AVATAR, labelKey: "rewards.center.shop.categories.avatar" },
      { id: shopCategories.ACCESSORY, labelKey: "rewards.center.shop.categories.accessory" },
      { id: shopCategories.FRAME, labelKey: "rewards.center.shop.categories.frame" },
      { id: shopCategories.BACKGROUND, labelKey: "rewards.center.shop.categories.background" },
      { id: shopCategories.EFFECT, labelKey: "rewards.center.shop.categories.effect" },
    ],
    [shopCategories],
  );
  const [activeCategory, setActiveCategory] = useState(categories[0].id);

  const filteredItems = shopItems.filter((item) => item.category === activeCategory);

  return (
    <section className="reward-center-panel">
      <header className="reward-center-panel-header">
        <div>
          <p className="reward-center-panel-badge">🛍️ {t("rewards.center.shop.badge")}</p>
          <h2 className="reward-center-panel-title">{t("rewards.center.shop.title")}</h2>
          <p className="reward-center-panel-subtitle">{t("rewards.center.shop.subtitle")}</p>
        </div>
        <p className="reward-center-balance">
          {lexicoins} {t("rewards.coinsShort")}
        </p>
      </header>

      <div className="reward-center-tabs" role="tablist">
        {categories.map((category) => (
          <button
            aria-selected={activeCategory === category.id}
            className={[
              "reward-center-tab",
              activeCategory === category.id ? "reward-center-tab-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            role="tab"
            type="button"
          >
            {t(category.labelKey)}
          </button>
        ))}
      </div>

      <ul className="reward-shop-grid">
        {filteredItems.map((item) => {
          const canBuy = !item.owned && lexicoins >= item.price;

          return (
            <li className="reward-shop-card" key={item.id}>
              <span aria-hidden="true" className="reward-shop-card-icon">
                {item.icon}
              </span>
              <h3 className="reward-shop-card-title">
                {t(`rewards.center.shop.items.${item.id}.name`)}
              </h3>
              <p className="reward-shop-card-price">
                {item.price === 0
                  ? t("rewards.center.shop.free")
                  : `${item.price} ${t("rewards.coinsShort")}`}
              </p>
              {item.equipped ? (
                <span className="reward-shop-card-status">{t("rewards.center.shop.equippedLabel")}</span>
              ) : item.owned ? (
                <button className="reward-shop-card-action" onClick={() => onEquip(item.id)} type="button">
                  {t("rewards.center.shop.equip")}
                </button>
              ) : (
                <button
                  className="reward-shop-card-action"
                  disabled={!canBuy}
                  onClick={() => onBuy(item.id)}
                  type="button"
                >
                  {t("rewards.center.shop.buy")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default AvatarShop;
