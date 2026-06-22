const ALLOWED_ORIGIN_PREFIXES = ["capacitor://", "ionic://"];
const ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "http://localhost",
  "https://learn.lexiland.cc",
]);

export function isAllowedApiOrigin(origin) {
  if (!origin) {
    return false;
  }

  if (ALLOWED_ORIGINS.has(origin)) {
    return true;
  }

  return ALLOWED_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix));
}

export function applyApiCors(request, response) {
  const origin = request.headers?.origin || request.headers?.Origin || "";

  if (isAllowedApiOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  response.setHeader("Access-Control-Max-Age", "86400");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return true;
  }

  return false;
}
