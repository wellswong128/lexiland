import { useEffect, useState } from "react";
import { getIsStandaloneDisplay } from "../lib/pwaPlatform.js";

export function useStandaloneDisplay() {
  const [isStandalone, setIsStandalone] = useState(getIsStandaloneDisplay);

  useEffect(() => {
    const mediaQueries = [
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(display-mode: fullscreen)"),
      window.matchMedia("(display-mode: minimal-ui)"),
    ];

    const sync = () => {
      setIsStandalone(getIsStandaloneDisplay());
    };

    mediaQueries.forEach((mediaQuery) => {
      mediaQuery.addEventListener("change", sync);
    });

    return () => {
      mediaQueries.forEach((mediaQuery) => {
        mediaQuery.removeEventListener("change", sync);
      });
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("standalone-display", isStandalone);

    return () => {
      document.documentElement.classList.remove("standalone-display");
    };
  }, [isStandalone]);

  return isStandalone;
}
