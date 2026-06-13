import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import LanguageToggle from "./LanguageToggle.jsx";
import LexiMascot from "./LexiMascot.jsx";

const navSections = [
  {
    labelKey: "nav.sectionLearn",
    items: [
      { to: "/", labelKey: "nav.home", end: true },
      { to: "/words", labelKey: "nav.words" },
      { to: "/words/new", labelKey: "nav.addWord" },
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

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="lexi-menu-fab-icon size-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.25"
      viewBox="0 0 24 24"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="lexi-menu-fab-icon size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function LexiFloatingMenu() {
  const { t } = useLocale();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? t("nav.closeMenu") : t("nav.openMenu")}
        className={["lexi-menu-fab", isOpen ? "lexi-menu-fab-open" : ""].filter(Boolean).join(" ")}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {isOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

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
          <div className="lexi-menu-brand">
            <LexiMascot size="md" title={t("brand.mascotAlt")} />
            <div>
              <p className="lexi-menu-title">{t("nav.menuTitle")}</p>
              <p className="lexi-menu-subtitle">{t("brand.mascotName")}</p>
            </div>
          </div>
          <button
            aria-label={t("nav.closeMenu")}
            className="lexi-menu-close"
            onClick={closeMenu}
            type="button"
          >
            <CloseIcon />
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

        <div className="lexi-menu-footer">
          <p className="lexi-menu-footer-label">{t("language.title")}</p>
          <LanguageToggle className="w-full" showInlineOptions />
        </div>
      </aside>
    </>
  );
}

export default LexiFloatingMenu;
