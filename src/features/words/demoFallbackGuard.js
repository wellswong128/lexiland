const DEMO_FALLBACK_TAG = "ai-fallback";

export function hasDemoFallbackTag(tags) {
  if (Array.isArray(tags)) {
    return tags.some((tag) => String(tag).trim().toLowerCase() === DEMO_FALLBACK_TAG);
  }

  if (typeof tags !== "string") {
    return false;
  }

  return tags
    .split(",")
    .some((tag) => tag.trim().toLowerCase() === DEMO_FALLBACK_TAG);
}

export function shouldBlockDemoFallbackSave(formValues, hasPendingFallbackCompletion) {
  return Boolean(hasPendingFallbackCompletion && hasDemoFallbackTag(formValues?.tags));
}
