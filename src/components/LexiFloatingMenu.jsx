import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";

const navSections = [
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
    items: [{ to: "/settings", labelKey: "nav.settings" }],
  },
];

function LexiFloatingMenu({ isOpen, onOpenChange }) {
  const { t } = useLocale();

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
