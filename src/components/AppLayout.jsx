import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import BottomNav from "./BottomNav.jsx";
import LexiFloatingMenu from "./LexiFloatingMenu.jsx";
import {
  getActivityForLocation,
  recordLearningActivity,
} from "../lib/learningActivity.js";
import { useGameViewport } from "../hooks/useGameViewport.js";

function AppLayout({ children }) {
  const location = useLocation();
  const isGamePage = location.pathname.startsWith("/games/");
  const isAuthPage = location.pathname.startsWith("/auth");
  const isHomePage = location.pathname === "/";
  const showFloatingMenu = !isGamePage && !isAuthPage;
  const showBottomNav = showFloatingMenu;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useGameViewport(isGamePage);

  useEffect(() => {
    if (!isGamePage) {
      return undefined;
    }

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    return undefined;
  }, [isGamePage, location.pathname]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (isGamePage) {
      root.classList.add("game-active");
      body.classList.add("game-active");
    } else {
      root.classList.remove("game-active");
      body.classList.remove("game-active");
    }

    return () => {
      root.classList.remove("game-active");
      body.classList.remove("game-active");
    };
  }, [isGamePage, location.pathname]);

  useEffect(() => {
    const activity = getActivityForLocation(location.pathname, location.search);

    if (activity) {
      recordLearningActivity(activity);
    }
  }, [location.pathname, location.search]);

  return (
    <div
      className={
        isGamePage
          ? "game-layout-shell flex min-h-0 flex-col overflow-hidden"
          : "app-shell flex min-h-[100svh] flex-col text-slate-900"
      }
    >
      {showFloatingMenu ? (
        <LexiFloatingMenu isOpen={isMenuOpen} onOpenChange={setIsMenuOpen} />
      ) : null}
      {showBottomNav ? (
        <BottomNav isMenuOpen={isMenuOpen} onMenuToggle={() => setIsMenuOpen((open) => !open)} />
      ) : null}
      <main
        className={
          isGamePage
            ? "flex h-full w-full min-h-0 flex-1 flex-col"
            : isAuthPage
              ? "mx-auto grid min-h-[100svh] w-full max-w-6xl flex-1 place-items-center px-2 py-2"
              : isHomePage
                ? "relative z-0 mx-auto flex w-full max-w-[430px] flex-1 items-start justify-center px-0 py-0 pb-[calc(96px+env(safe-area-inset-bottom,0px))]"
                : "relative z-0 mx-auto flex w-full max-w-6xl flex-1 items-start justify-center px-3 py-3 pb-[calc(96px+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6"
        }
      >
        {children}
      </main>
    </div>
  );
}

export default AppLayout;
