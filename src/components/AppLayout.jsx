import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import LanguageToggle from "./LanguageToggle.jsx";

const navItems = [
  { to: "/", labelKey: "nav.home", end: true },
  { to: "/words", labelKey: "nav.words" },
  { to: "/words/new", labelKey: "nav.addWord" },
  { to: "/review/flashcards", labelKey: "nav.flashcards" },
  { to: "/review/quiz", labelKey: "nav.quiz" },
  { to: "/games/spelling-ninja", labelKey: "nav.ninjaGame" },
  { to: "/games/fishing-blast", labelKey: "nav.fishBlast" },
  { to: "/games/word-kart", labelKey: "nav.wordKart" },
  { to: "/games/grammar-arena", labelKey: "nav.grammarArena" },
  { to: "/games/battle-jet", labelKey: "nav.battleJet" },
  { to: "/games/penalty-twelve", labelKey: "nav.penaltyTwelve" },
  { to: "/mistakes", labelKey: "nav.mistakes" },
  { to: "/settings", labelKey: "nav.settings" },
];

function MenuIcon({ isOpen }) {
  if (isOpen) {
    return (
      <svg
        aria-hidden="true"
        className="size-6"
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

  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function AppLayout({ children }) {
  const { t } = useLocale();
  const location = useLocation();
  const isGamePage = location.pathname.startsWith("/games/");
  const isAuthPage = location.pathname.startsWith("/auth");
  const hideHeader = isGamePage || isAuthPage;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100svh] flex-col bg-blue-50 text-slate-900">
      {hideHeader ? null : (
        <header className="relative z-50 overflow-visible border-b border-blue-200/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
            <button
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              className="inline-flex size-11 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-950 transition hover:bg-blue-50"
              onClick={() => setIsMenuOpen((open) => !open)}
              type="button"
            >
              <MenuIcon isOpen={isMenuOpen} />
            </button>
            <NavLink
              to="/"
              className="min-w-0 flex-1 truncate rounded-lg text-2xl font-bold tracking-tight text-blue-950"
            >
              {t("brand.name")}
            </NavLink>
            <div className="relative z-50 ml-auto shrink-0">
              <LanguageToggle />
            </div>
          </div>

          {isMenuOpen ? (
            <nav className="mx-auto max-w-6xl border-t border-blue-100 px-4 py-3 sm:px-6">
              <ul className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        [
                          "block rounded-xl px-4 py-3 text-sm font-semibold transition",
                          isActive
                            ? "bg-blue-700 text-white shadow-sm shadow-blue-900/20"
                            : "text-slate-600 hover:bg-blue-100 hover:text-blue-950",
                        ].join(" ")
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t(item.labelKey)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </header>
      )}

      <main
        className={
          hideHeader
            ? "mx-auto grid min-h-[100svh] w-full max-w-6xl place-items-center px-2 py-2"
            : "relative z-0 mx-auto flex w-full max-w-6xl flex-1 items-start justify-center px-3 py-3 sm:px-6 sm:py-6"
        }
      >
        {children}
      </main>
    </div>
  );
}

export default AppLayout;
