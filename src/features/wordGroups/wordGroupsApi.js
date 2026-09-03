import { getApiAuthHeaders } from "../../lib/apiAuth.js";
import { resolveApiUrl } from "../../lib/apiBase.js";
import { supabase } from "../../lib/supabaseClient.js";
import { activeGroupWordsCache } from "./activeGroupWordsCache.js";

const FETCH_TIMEOUT_MS = 45_000;

export const ACTIVE_GROUP_INITIAL_IMPORT_COUNT = 10;

async function parseJsonResponse(response) {
  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const apiError = typeof payload.error === "string" ? payload.error.trim() : "";
    throw new Error(apiError || `Request failed (${response.status}).`);
  }

  return payload;
}

async function getApiAuthContext() {
  if (!supabase) {
    return { authHeaders: {}, cacheScopeKey: "" };
  }

  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    const token = session?.access_token;
    const userId = session?.user?.id;

    return {
      authHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      cacheScopeKey: userId ? `user:${userId}` : "",
    };
  } catch {
    return { authHeaders: {}, cacheScopeKey: "" };
  }
}

async function fetchUserActiveGroupWordsFromNetwork({
  includeWords = false,
  wordLimit = 0,
  authHeaders = null,
} = {}) {
  const resolvedAuthHeaders = authHeaders ?? (await getApiAuthHeaders());
  const params = new URLSearchParams();
  if (includeWords) {
    params.set("includeWords", "1");
  }
  if (wordLimit > 0) {
    params.set("wordLimit", String(wordLimit));
  }
  const queryString = params.toString();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      resolveApiUrl(`/api/user-active-group-words${queryString ? `?${queryString}` : ""}`),
      {
        headers: {
          "Content-Type": "application/json",
          ...resolvedAuthHeaders,
        },
        signal: controller.signal,
      },
    );

    return parseJsonResponse(response);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Timed out loading active group words.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function invalidateUserActiveGroupWordsCache() {
  activeGroupWordsCache.clear();
}

export async function fetchUserActiveGroupWords(options = {}) {
  const includeWords = Boolean(options.includeWords);
  const wordLimit = Number(options.wordLimit) > 0 ? Number(options.wordLimit) : 0;
  const forceRefresh = Boolean(options.forceRefresh);
  const { authHeaders, cacheScopeKey } = await getApiAuthContext();
  const cachedPayload = !forceRefresh
    ? activeGroupWordsCache.read(cacheScopeKey, { includeWords, wordLimit })
    : null;

  if (cachedPayload) {
    return cachedPayload;
  }

  if (includeWords) {
    if (wordLimit > 0) {
      return fetchUserActiveGroupWordsFromNetwork({
        includeWords: true,
        wordLimit,
        authHeaders,
      });
    }

    const inflightFullRequest = !forceRefresh
      ? activeGroupWordsCache.readInflight(cacheScopeKey, "full")
      : null;
    if (inflightFullRequest) {
      return inflightFullRequest;
    }

    const nextFullRequest = fetchUserActiveGroupWordsFromNetwork({
      includeWords: true,
      wordLimit,
      authHeaders,
    })
      .then((payload) => {
        activeGroupWordsCache.writeFull(cacheScopeKey, payload);
        return payload;
      });

    return activeGroupWordsCache.trackInflight(cacheScopeKey, "full", nextFullRequest);
  }

  const inflightFullRequest = !forceRefresh
    ? activeGroupWordsCache.readInflight(cacheScopeKey, "full")
    : null;
  if (inflightFullRequest && wordLimit === 0) {
    const fullPayload = await inflightFullRequest;
    const { mappedWords: _mappedWords, ...rest } = fullPayload;
    return rest;
  }

  const inflightTermsRequest = !forceRefresh
    ? activeGroupWordsCache.readInflight(cacheScopeKey, "terms")
    : null;
  if (inflightTermsRequest) {
    return inflightTermsRequest;
  }

  const nextTermsRequest = fetchUserActiveGroupWordsFromNetwork({
    includeWords: false,
    authHeaders,
  })
    .then((payload) => {
      activeGroupWordsCache.writeTerms(cacheScopeKey, payload);
      return payload;
    });

  return activeGroupWordsCache.trackInflight(cacheScopeKey, "terms", nextTermsRequest);
}

export async function importUserActiveGroupWords({ limit = null, wordLimit = 0 } = {}) {
  const authHeaders = await getApiAuthHeaders();
  const body = {};
  if (limit != null && limit > 0) {
    body.limit = limit;
  }
  if (wordLimit > 0) {
    body.wordLimit = wordLimit;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(resolveApiUrl("/api/user-active-group-words"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    return parseJsonResponse(response);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Timed out importing active group words.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function syncUserActiveGroupWordMemory({ terms = [] } = {}) {
  const authHeaders = await getApiAuthHeaders();
  const body = { syncMemoryOnly: true };

  if (Array.isArray(terms) && terms.length > 0) {
    body.terms = terms;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(resolveApiUrl("/api/user-active-group-words"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    return parseJsonResponse(response);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Timed out syncing group word memory.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchWordGroups() {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch(resolveApiUrl("/api/word-groups"), {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
  });

  return parseJsonResponse(response);
}

export async function fetchUserGroupPicks() {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch(resolveApiUrl("/api/user-group-picks"), {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
  });

  return parseJsonResponse(response);
}

export async function saveUserGroupPicks(groupCodes) {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch(resolveApiUrl("/api/user-group-picks"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ groupCodes }),
  });

  return parseJsonResponse(response);
}

export async function fetchUserActiveGroup() {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch(resolveApiUrl("/api/user-active-group"), {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
  });

  return parseJsonResponse(response);
}

export async function setUserActiveGroup(
  groupCode,
  { includeWords = false, wordLimit = 0 } = {},
) {
  const authHeaders = await getApiAuthHeaders();
  const body = { groupCode, includeWords };
  if (wordLimit > 0) {
    body.wordLimit = wordLimit;
  }
  const response = await fetch(resolveApiUrl("/api/user-active-group"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(body),
  });

  const payload = await parseJsonResponse(response);
  invalidateUserActiveGroupWordsCache();
  return payload;
}
