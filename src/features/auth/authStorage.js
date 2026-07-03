import {
  clearPkceVerifierBackup,
  isPkceVerifierStorageKey,
  readPkceVerifierMirror,
  writePkceVerifierMirror,
} from "./pkceStorage.js";

export function createMobileWebAuthStorage() {
  return {
    getItem(key) {
      try {
        const localValue = localStorage.getItem(key);

        if (localValue !== null) {
          return localValue;
        }
      } catch {
        // localStorage may be unavailable.
      }

      if (!isPkceVerifierStorageKey(key)) {
        return null;
      }

      const mirror = readPkceVerifierMirror();

      if (mirror === null) {
        return null;
      }

      try {
        localStorage.setItem(key, mirror);
      } catch {
        // localStorage may be unavailable.
      }

      return mirror;
    },
    setItem(key, value) {
      localStorage.setItem(key, value);

      if (isPkceVerifierStorageKey(key)) {
        writePkceVerifierMirror(value);
      }
    },
    removeItem(key) {
      localStorage.removeItem(key);

      if (isPkceVerifierStorageKey(key)) {
        clearPkceVerifierBackup();
      }
    },
  };
}
