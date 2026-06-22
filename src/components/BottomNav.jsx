import { NavLink } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";

const navItems = [
  { key: "home", labelKey: "bottomNav.home", to: "/", end: true, emoji: "🏠" },
  {
    key: "photoScan",
    labelKey: "bottomNav.photoScan",
    to: "/words/new?tab=photo&scan=camera",
    emoji: "📷",
    featured: true,
  },
  { key: "achievements", labelKey: "bottomNav.achievements", to: "/achievements", emoji: "🏆" },
  { key: "menu", labelKey: "bottomNav.menu", emoji: "☰", action: "menu" },
];

function BottomNav({ isMenuOpen = false, onMenuToggle }) {
  const { t } = useLocale();

  return (
    <nav aria-label={t("bottomNav.label")} className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.map((item) =>
          item.action === "menu" ? (
            <button
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              className={[
                "bottom-nav-link",
                "bottom-nav-menu",
                isMenuOpen ? "bottom-nav-link-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={item.key}
              onClick={onMenuToggle}
              type="button"
            >
              <span aria-hidden="true" className="bottom-nav-emoji">
                {item.emoji}
              </span>
              <span className="bottom-nav-label">{t(item.labelKey)}</span>
            </button>
          ) : (
            <NavLink
              aria-label={t(item.labelKey)}
              className={({ isActive }) =>
                [
                  "bottom-nav-link",
                  item.featured ? "bottom-nav-link-featured" : "",
                  isActive ? "bottom-nav-link-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              end={item.end}
              key={item.key}
              to={item.to}
            >
              <span aria-hidden="true" className="bottom-nav-emoji">
                {item.emoji}
              </span>
              <span className="bottom-nav-label">{t(item.labelKey)}</span>
            </NavLink>
          ),
        )}
      </div>
    </nav>
  );
}

export default BottomNav;
