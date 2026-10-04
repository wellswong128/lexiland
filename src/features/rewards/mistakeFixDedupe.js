export function buildMistakeFixDedupeKey(scope, word) {
  const wordId = word?.id ?? "unknown";
  const mistakeCount = Number(word?.mistake?.mistakeCount) || 0;
  const lastMistakeAt = word?.mistake?.lastMistakeAt ?? "unknown";

  return `${scope}:${wordId}:${mistakeCount}:${lastMistakeAt}`;
}
