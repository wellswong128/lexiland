const PKCE_VERIFIER_BACKUP_KEY = "lexiland.auth.pkce-verifier-backup";
const PKCE_VERIFIER_COOKIE = "lexiland_pkce_verifier";
const PKCE_VERIFIER_SUFFIX = "-code-verifier";

export function isPkceVerifierStorageKey(key) {
  return typeof key === "string" && key.endsWith(PKCE_VERIFIER_SUFFIX);
}

export function getPkceVerifierStorageKey() {
  const url = import.meta.env.VITE_SUPABASE_URL;

  if (!url) {
    return null;
  }

  try {
    const projectRef = new URL(url).hostname.split(".")[0];
    return `sb-${projectRef}-auth-token-code-verifier`;
  } catch {
    return null;
  }
}

function setPkceVerifierCookie(value) {
  if (typeof document === "undefined") {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PKCE_VERIFIER_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=600; SameSite=Lax${secure}`;
}

function getPkceVerifierCookie() {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${PKCE_VERIFIER_COOKIE}=`;

  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }

  return null;
}

function clearPkceVerifierCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${PKCE_VERIFIER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function readPkceVerifierMirror() {
  if (typeof sessionStorage !== "undefined") {
    try {
      const sessionValue = sessionStorage.getItem(PKCE_VERIFIER_BACKUP_KEY);
      if (sessionValue) {
        return sessionValue;
      }
    } catch {
      // sessionStorage may be unavailable.
    }
  }

  return getPkceVerifierCookie();
}

export function writePkceVerifierMirror(value) {
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, value);
    } catch {
      // sessionStorage may be unavailable.
    }
  }

  setPkceVerifierCookie(value);
}

export function hasPkceVerifier() {
  const key = getPkceVerifierStorageKey();

  if (key && typeof localStorage !== "undefined") {
    try {
      if (localStorage.getItem(key)) {
        return true;
      }
    } catch {
      // localStorage may be unavailable.
    }
  }

  return Boolean(readPkceVerifierMirror());
}

export async function waitForPkceVerifier({ attempts = 60, delayMs = 100 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (hasPkceVerifier()) {
      return true;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, delayMs);
    });
  }

  return hasPkceVerifier();
}

export function backupPkceVerifier() {
  const key = getPkceVerifierStorageKey();

  if (!key || typeof localStorage === "undefined") {
    return;
  }

  try {
    const verifier = localStorage.getItem(key);

    if (verifier) {
      writePkceVerifierMirror(verifier);
    }
  } catch {
    // Storage may be unavailable.
  }
}

export function restorePkceVerifierBackup() {
  const key = getPkceVerifierStorageKey();

  if (!key || typeof localStorage === "undefined") {
    return false;
  }

  try {
    if (localStorage.getItem(key)) {
      return true;
    }

    const backup = readPkceVerifierMirror();

    if (backup) {
      localStorage.setItem(key, backup);
      return true;
    }
  } catch {
    // Storage may be unavailable.
  }

  return false;
}

export function clearPkceVerifierBackup() {
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(PKCE_VERIFIER_BACKUP_KEY);
    } catch {
      // sessionStorage may be unavailable.
    }
  }

  clearPkceVerifierCookie();
}
