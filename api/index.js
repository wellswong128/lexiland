import { routeRequest } from "../server/api/router.js";

function readPathFromUrl(requestUrl) {
  const rawUrl = String(requestUrl || "").trim();
  if (!rawUrl) {
    return "";
  }

  try {
    const pathname = rawUrl.startsWith("/")
      ? rawUrl.split("?")[0]
      : new URL(rawUrl).pathname;

    const apiPrefix = "/api/";
    const apiIndex = pathname.indexOf(apiPrefix);
    if (apiIndex < 0) {
      return "";
    }

    return decodeURIComponent(pathname.slice(apiIndex + apiPrefix.length)).replace(/^\/+|\/+$/g, "");
  } catch {
    return "";
  }
}

function readPath(request) {
  const raw = request.query?.path;

  if (Array.isArray(raw)) {
    const joined = raw.join("/").trim();
    if (joined) {
      return joined;
    }
  } else if (raw) {
    return String(raw).trim();
  }

  return readPathFromUrl(request.url);
}

export default async function handler(request, response) {
  await routeRequest(readPath(request), request, response);
}
