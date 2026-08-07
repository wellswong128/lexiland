const DEFAULT_FALLBACK_MESSAGE = "AI Fill returned demo fallback data. Please retry.";

export function assertRealPhotoCompletion(result) {
  if (result?.usedFallback) {
    throw new Error(result.fallbackReason || DEFAULT_FALLBACK_MESSAGE);
  }

  return result;
}
