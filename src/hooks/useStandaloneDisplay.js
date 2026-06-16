import { useEffect, useState } from "react";

function getIsStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true
  );
}

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
