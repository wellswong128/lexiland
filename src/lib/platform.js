import { Capacitor } from "@capacitor/core";

export function isCapacitorNative() {
  return Capacitor.isNativePlatform();
}

export function getNativePlatform() {
  return Capacitor.getPlatform();
}

export function isNativeAppShell() {
  return isCapacitorNative();
}
