export function shouldSkipAnonymousSaveAfterSignOut({
  hasSupabaseConfig,
  lastAuthenticatedUserId,
}) {
  return Boolean(hasSupabaseConfig && lastAuthenticatedUserId);
}

export function getAnonymousWordsSaveAction({
  hasSupabaseConfig,
  hasUser,
  skipNextAnonymousSave,
}) {
  if (hasUser) {
    return { shouldSave: false, shouldClearSkip: false };
  }

  if (hasSupabaseConfig && skipNextAnonymousSave) {
    return { shouldSave: false, shouldClearSkip: true };
  }

  return { shouldSave: true, shouldClearSkip: false };
}
