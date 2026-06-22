import { Capacitor } from "@capacitor/core";

export function getPwaPlatform() {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === "ios" ? "ios" : "android";
  }

  const userAgent = navigator.userAgent || "";

  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return "ios";
  }

  if (/android/i.test(userAgent)) {
    return "android";
  }

  return "desktop";
}

export function getIsStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  if (Capacitor.isNativePlatform()) {
    return true;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true
  );
}

export function getServiceWorkerSupport() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}
