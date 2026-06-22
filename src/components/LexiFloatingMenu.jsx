import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { can, getRoleFromUser, PERMISSIONS } from "../lib/authorization.js";

const baseNavSections = [
  {
    labelKey: "nav.sectionLearn",
    items: [
      { to: "/", labelKey: "nav.home", end: true },
      { to: "/words", labelKey: "nav.words" },
    ],
  },
  {
    labelKey: "nav.sectionReview",
    items: [
      { to: "/review/flashcards", labelKey: "nav.flashcards" },
      { to: "/review/quiz", labelKey: "nav.quiz" },
      { to: "/mistakes", labelKey: "nav.mistakes" },
    ],
  },
  {
    labelKey: "nav.sectionGames",
    items: [
      { to: "/games/spelling-ninja", labelKey: "nav.ninjaGame" },
      { to: "/games/fishing-blast", labelKey: "nav.fishBlast" },
      { to: "/games/word-kart", labelKey: "nav.wordKart" },
      { to: "/games/battle-jet", labelKey: "nav.battleJet" },
      { to: "/games/penalty-twelve", labelKey: "nav.penaltyTwelve" },
    ],
  },
  {
    labelKey: "nav.sectionApp",
    items: [
      { to: "/learning-report", labelKey: "bottomNav.learningRecord" },
      { to: "/achievements", labelKey: "bottomNav.achievements" },
      { to: "/install", labelKey: "nav.installApp" },
      { to: "/settings", labelKey: "nav.settings" },
    ],
  },
];

function LexiFloatingMenu({ isOpen, onOpenChange }) {
  const { t } = useLocale();
  const { user } = useWordsContext();
  const role = getRoleFromUser(user);
  const canManageUsers = can(role, PERMISSIONS.SETTINGS_MANAGE_USERS);
  const navSections = canManageUsers
    ? baseNavSections.map((section) =>
        section.labelKey === "nav.sectionApp"
          ? {
              ...section,
              items: [
                ...section.items,
                { to: "/admin/users", labelKey: "nav.manageRoles" },
                { to: "/admin/wordbase", labelKey: "nav.manageWordbase" },
                { to: "/admin/wordbase-library", labelKey: "nav.wordbaseLibrary" },
              ],
            }
          : section,
      )
    : baseNavSections;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onOpenChange]);

  function closeMenu() {
    onOpenChange(false);
  }

  return (
    <>
      <div
        aria-hidden={!isOpen}
        className={["lexi-menu-backdrop", isOpen ? "lexi-menu-backdrop-open" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={closeMenu}
      />

      <aside
        aria-hidden={!isOpen}
        aria-label={t("nav.menuTitle")}
        className={["lexi-menu-panel", isOpen ? "lexi-menu-panel-open" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="lexi-menu-header">
          <p className="lexi-menu-title">{t("nav.menuTitle")}</p>
          <button
            aria-label={t("nav.closeMenu")}
            className="lexi-menu-close"
            onClick={closeMenu}
            type="button"
          >
            ×
          </button>
        </div>

        <nav className="lexi-menu-nav">
          {navSections.map((section) => (
            <div className="lexi-menu-section" key={section.labelKey}>
              <p className="lexi-menu-section-label">{t(section.labelKey)}</p>
              <ul className="lexi-menu-list">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      className={({ isActive }) =>
                        [
                          "lexi-menu-link",
                          isActive ? "lexi-menu-link-active" : "",
                        ].join(" ")
                      }
                      end={item.end}
                      onClick={closeMenu}
                      to={item.to}
                    >
                      {t(item.labelKey)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default LexiFloatingMenu;
