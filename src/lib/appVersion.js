const APP_BUILD_ID = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
const APP_SEMVER = typeof __APP_SEMVER__ === "string" ? __APP_SEMVER__ : "1.0.0";
const APP_BUILT_AT = typeof __APP_BUILT_AT__ === "string" ? __APP_BUILT_AT__ : "";

/** Internal build id used to detect new deployments. */
export function getAppVersion() {
  return APP_BUILD_ID;
}

export function getAppSemver() {
  return APP_SEMVER;
}

export function formatAppVersionLabel(
  { semver, builtAt, build } = {},
  locale = typeof navigator !== "undefined" ? navigator.language : "en-GB",
) {
  const version = semver || APP_SEMVER;
  const buildId = build || APP_BUILD_ID;
  const buildSuffix = buildId && buildId !== "dev" ? ` (${buildId})` : "";

  if (!builtAt) {
    return `${version}${buildSuffix}`;
  }

  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(builtAt));

  return `${version}${buildSuffix} · ${date}`;
}

/** User-facing version label for the currently loaded app bundle. */
export function getAppVersionLabel(locale) {
  return formatAppVersionLabel(
    { semver: APP_SEMVER, builtAt: APP_BUILT_AT, build: APP_BUILD_ID },
    locale,
  );
}

function normalizeVersionPayload(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const build =
    (typeof data.build === "string" && data.build.trim()) ||
    (typeof data.version === "string" && data.version.trim()) ||
    "";
  const semver =
    (typeof data.semver === "string" && data.semver.trim()) ||
    (typeof data.label === "string" && data.label.trim()) ||
    build;
  const builtAt = typeof data.builtAt === "string" ? data.builtAt : "";

  if (!build) {
    return null;
  }

  return {
    build,
    builtAt,
    semver,
  };
}

export async function fetchLatestAppVersionInfo() {
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

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }

    const data = await response.json();
    return normalizeVersionPayload(data);
  } catch {
    return null;
  }
}

/** @deprecated Use fetchLatestAppVersionInfo() for display metadata. */
export async function fetchLatestAppVersion() {
  const info = await fetchLatestAppVersionInfo();
  return info?.build ?? null;
}

export function hasRemoteVersionUpdate(latestBuild) {
  return Boolean(latestBuild && latestBuild !== getAppVersion());
}
