const PKCE_VERIFIER_BACKUP_KEY = "lexiland.auth.pkce-verifier-backup";

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

export async function waitForPkceVerifier({ attempts = 40, delayMs = 50 } = {}) {
  const key = getPkceVerifierStorageKey();

  if (!key || typeof localStorage === "undefined") {
    return false;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (localStorage.getItem(key)) {
      return true;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, delayMs);
    });
  }

  return Boolean(localStorage.getItem(key));
}

export function backupPkceVerifier() {
  const key = getPkceVerifierStorageKey();

  if (!key || typeof localStorage === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }

  try {
    const verifier = localStorage.getItem(key);

    if (verifier) {
      sessionStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, verifier);
    }
  } catch {
    // sessionStorage may be unavailable.
  }
}

export function restorePkceVerifierBackup() {
  const key = getPkceVerifierStorageKey();

  if (!key || typeof localStorage === "undefined" || typeof sessionStorage === "undefined") {
    return false;
  }

  try {
    if (localStorage.getItem(key)) {
      return true;
    }

    const backup = sessionStorage.getItem(PKCE_VERIFIER_BACKUP_KEY);

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
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(PKCE_VERIFIER_BACKUP_KEY);
  } catch {
    // sessionStorage may be unavailable.
  }
}
