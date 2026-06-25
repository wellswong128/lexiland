const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

export function getAppVersion() {
  return APP_VERSION;
}

export async function fetchLatestAppVersion() {
  if (typeof fetch === "undefined") {
    return null;
  }

  try {
    const response = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const version = typeof data?.version === "string" ? data.version.trim() : "";

    return version || null;
  } catch {
    return null;
  }
}

export function hasRemoteVersionUpdate(latestVersion) {
  return Boolean(latestVersion && latestVersion !== getAppVersion());
}
