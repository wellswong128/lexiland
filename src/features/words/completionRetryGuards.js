export function isUsableCompletionRetryResult(result) {
  return Boolean(result?.suggestion && result.usedFallback === false);
}

export function getCompletionRetryFailureReason(
  result,
  fallbackMessage = "AI Fill failed. Please try again.",
) {
  const reason = String(result?.fallbackReason ?? "").trim();
  return reason || fallbackMessage;
}
