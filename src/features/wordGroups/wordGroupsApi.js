import { getApiAuthHeaders } from "../../lib/apiAuth.js";
import { resolveApiUrl } from "../../lib/apiBase.js";

const CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 45_000;

export const ACTIVE_GROUP_INITIAL_IMPORT_COUNT = 10;

let cachedFullPayload = null;
let cachedAt = 0;
let inflightFullRequest = null;
let inflightTermsRequest = null;

async function parseJsonResponse(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function isCacheValid() {
  return Boolean(cachedFullPayload) && Date.now() - cachedAt < CACHE_TTL_MS;
}

function stripWordsFromPayload(payload) {
  const { mappedWords: _mappedWords, ...rest } = payload;
  return rest;
}

async function fetchUserActiveGroupWordsFromNetwork({ includeWords = false, wordLimit = 0 } = {}) {
  const authHeaders = await getApiAuthHeaders();
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
          ...authHeaders,
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
  cachedFullPayload = null;
  cachedAt = 0;
  inflightFullRequest = null;
  inflightTermsRequest = null;
}

export async function fetchUserActiveGroupWords(options = {}) {
  const includeWords = Boolean(options.includeWords);
  const wordLimit = Number(options.wordLimit) > 0 ? Number(options.wordLimit) : 0;
  const forceRefresh = Boolean(options.forceRefresh);

  if (!forceRefresh && isCacheValid() && wordLimit === 0) {
    if (!includeWords) {
      return stripWordsFromPayload(cachedFullPayload);
    }
    if (Array.isArray(cachedFullPayload.mappedWords)) {
      return cachedFullPayload;
    }
  }

  if (includeWords) {
    if (wordLimit > 0) {
      return fetchUserActiveGroupWordsFromNetwork({ includeWords: true, wordLimit });
    }

    if (!forceRefresh && inflightFullRequest) {
      return inflightFullRequest;
    }

    inflightFullRequest = fetchUserActiveGroupWordsFromNetwork({ includeWords: true, wordLimit })
      .then((payload) => {
        cachedFullPayload = payload;
        cachedAt = Date.now();
        return payload;
      })
      .finally(() => {
        inflightFullRequest = null;
      });

    return inflightFullRequest;
  }

  if (!forceRefresh && inflightFullRequest && wordLimit === 0) {
    const fullPayload = await inflightFullRequest;
    return stripWordsFromPayload(fullPayload);
  }

  if (!forceRefresh && inflightTermsRequest) {
    return inflightTermsRequest;
  }

  inflightTermsRequest = fetchUserActiveGroupWordsFromNetwork({ includeWords: false })
    .then((payload) => {
      if (!isCacheValid() || cachedFullPayload?.mappedWords) {
        cachedFullPayload = payload;
        cachedAt = Date.now();
      }
      return payload;
    })
    .finally(() => {
      inflightTermsRequest = null;
    });

  return inflightTermsRequest;
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
