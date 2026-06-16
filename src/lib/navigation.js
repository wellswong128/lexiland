export function goBackToPreviousPage(navigate, location, fallback = "/words") {
  if (location.key !== "default") {
    navigate(-1);
    return;
  }

  navigate(fallback);
}
