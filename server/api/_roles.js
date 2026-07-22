export function readTrustedAppRole(user, fallbackRole = "student") {
  const fallback = String(fallbackRole || "student").trim().toLowerCase() || "student";
  const role = String(user?.app_metadata?.role ?? fallback).trim().toLowerCase();
  return role || fallback;
}
