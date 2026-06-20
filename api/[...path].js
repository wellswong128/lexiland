import { routeRequest } from "../server/api/router.js";

function readPath(request) {
  const raw = request.query?.path;

  if (Array.isArray(raw)) {
    return raw.join("/");
  }

  return String(raw || "").trim();
}

export default async function handler(request, response) {
  await routeRequest(readPath(request), request, response);
}
