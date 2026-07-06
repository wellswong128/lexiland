function normalizeFetchError(error) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error ?? "Request failed."));
}

export async function fetchWithTimeout(url, options = {}, { timeoutMs = 90000 } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    const normalized = normalizeFetchError(error);

    if (normalized.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }

    throw normalized;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
