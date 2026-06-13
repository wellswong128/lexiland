import { useEffect } from "react";

function updateGameViewportVars() {
  const root = document.documentElement;
  const viewport = window.visualViewport;

  if (!viewport) {
    root.style.setProperty("--game-vh", `${window.innerHeight}px`);
    root.style.setProperty("--game-vw", `${window.innerWidth}px`);
    root.style.setProperty("--game-vt", "0px");
    root.style.setProperty("--game-vl", "0px");
    return;
  }

  root.style.setProperty("--game-vh", `${viewport.height}px`);
  root.style.setProperty("--game-vw", `${viewport.width}px`);
  root.style.setProperty("--game-vt", `${viewport.offsetTop}px`);
  root.style.setProperty("--game-vl", `${viewport.offsetLeft}px`);
}

function clearGameViewportVars() {
  const root = document.documentElement;

  root.style.removeProperty("--game-vh");
  root.style.removeProperty("--game-vw");
  root.style.removeProperty("--game-vt");
  root.style.removeProperty("--game-vl");
}

export function useGameViewport(active) {
  useEffect(() => {
    if (!active) {
      clearGameViewportVars();
      return undefined;
    }

    updateGameViewportVars();

    const viewport = window.visualViewport;

    viewport?.addEventListener("resize", updateGameViewportVars);
    viewport?.addEventListener("scroll", updateGameViewportVars);
    window.addEventListener("resize", updateGameViewportVars);
    window.addEventListener("orientationchange", updateGameViewportVars);

    return () => {
      viewport?.removeEventListener("resize", updateGameViewportVars);
      viewport?.removeEventListener("scroll", updateGameViewportVars);
      window.removeEventListener("resize", updateGameViewportVars);
      window.removeEventListener("orientationchange", updateGameViewportVars);
      clearGameViewportVars();
    };
  }, [active]);
}
