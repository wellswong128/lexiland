const DEFAULT_CACHE_TTL_MS = 60_000;

export function stripWordsFromPayload(payload) {
  const { mappedWords: _mappedWords, ...rest } = payload;
  return rest;
}

export function createScopedPayloadCache({ ttlMs = DEFAULT_CACHE_TTL_MS, now = () => Date.now() } = {}) {
  let cachedFullPayload = null;
  let cachedAt = 0;
  let cachedScopeKey = "";
  let inflightFullRequest = null;
  let inflightFullScopeKey = "";
  let inflightTermsRequest = null;
  let inflightTermsScopeKey = "";

  function isCacheValid(scopeKey) {
    return Boolean(
      scopeKey &&
        cachedScopeKey === scopeKey &&
        cachedFullPayload &&
        now() - cachedAt < ttlMs,
    );
  }

  function read(scopeKey, { includeWords = false, wordLimit = 0 } = {}) {
    if (wordLimit !== 0 || !isCacheValid(scopeKey)) {
      return null;
    }

    if (!includeWords) {
      return stripWordsFromPayload(cachedFullPayload);
    }

    return Array.isArray(cachedFullPayload.mappedWords) ? cachedFullPayload : null;
  }

  function writeFull(scopeKey, payload) {
    if (!scopeKey) {
      return;
    }

    cachedFullPayload = payload;
    cachedAt = now();
    cachedScopeKey = scopeKey;
  }

  function writeTerms(scopeKey, payload) {
    if (!scopeKey) {
      return;
    }

    if (!isCacheValid(scopeKey) || cachedFullPayload?.mappedWords) {
      writeFull(scopeKey, payload);
    }
  }

  function readInflight(scopeKey, kind) {
    if (!scopeKey) {
      return null;
    }

    if (kind === "full") {
      return inflightFullScopeKey === scopeKey ? inflightFullRequest : null;
    }

    return inflightTermsScopeKey === scopeKey ? inflightTermsRequest : null;
  }

  function trackInflight(scopeKey, kind, request) {
    if (!scopeKey) {
      return request;
    }

    if (kind === "full") {
      inflightFullRequest = request;
      inflightFullScopeKey = scopeKey;

      return request.finally(() => {
        if (inflightFullRequest === request && inflightFullScopeKey === scopeKey) {
          inflightFullRequest = null;
          inflightFullScopeKey = "";
        }
      });
    }

    inflightTermsRequest = request;
    inflightTermsScopeKey = scopeKey;

    return request.finally(() => {
      if (inflightTermsRequest === request && inflightTermsScopeKey === scopeKey) {
        inflightTermsRequest = null;
        inflightTermsScopeKey = "";
      }
    });
  }

  function clear() {
    cachedFullPayload = null;
    cachedAt = 0;
    cachedScopeKey = "";
    inflightFullRequest = null;
    inflightFullScopeKey = "";
    inflightTermsRequest = null;
    inflightTermsScopeKey = "";
  }

  return {
    clear,
    read,
    readInflight,
    trackInflight,
    writeFull,
    writeTerms,
  };
}

export const activeGroupWordsCache = createScopedPayloadCache();
