export function getAppBaseUrl() {
  const configured =
    import.meta.env.VITE_APP_URL?.trim() ||
    import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const { origin, hostname } = window.location;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "https://learn.lexiland.cc";
    }

    return origin;
  }

  return "https://learn.lexiland.cc";
}

export function getAppInstallUrl(path = "/install") {
  const base = getAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return base ? `${base}${normalizedPath}` : normalizedPath;
}
