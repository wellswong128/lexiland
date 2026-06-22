import { getApiAuthHeaders } from "../../lib/apiAuth.js";

const CACHE_TTL_MS = 60_000;

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

async function fetchUserActiveGroupWordsFromNetwork(includeWords) {
  const authHeaders = await getApiAuthHeaders();
  const params = new URLSearchParams();
  if (includeWords) {
    params.set("includeWords", "1");
  }
  const queryString = params.toString();
  const response = await fetch(
    `/api/user-active-group-words${queryString ? `?${queryString}` : ""}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    },
  );

  return parseJsonResponse(response);
}

export function invalidateUserActiveGroupWordsCache() {
  cachedFullPayload = null;
  cachedAt = 0;
}

export async function fetchUserActiveGroupWords(options = {}) {
  const includeWords = Boolean(options.includeWords);
  const forceRefresh = Boolean(options.forceRefresh);

  if (!forceRefresh && isCacheValid()) {
    if (!includeWords) {
      return stripWordsFromPayload(cachedFullPayload);
    }
    if (Array.isArray(cachedFullPayload.mappedWords)) {
      return cachedFullPayload;
    }
  }

  if (includeWords) {
    if (!forceRefresh && inflightFullRequest) {
      return inflightFullRequest;
    }

    inflightFullRequest = fetchUserActiveGroupWordsFromNetwork(true)
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

  if (!forceRefresh && inflightFullRequest) {
    const fullPayload = await inflightFullRequest;
    return stripWordsFromPayload(fullPayload);
  }

  if (!forceRefresh && inflightTermsRequest) {
    return inflightTermsRequest;
  }

  inflightTermsRequest = fetchUserActiveGroupWordsFromNetwork(false)
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

export async function fetchWordGroups() {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch("/api/word-groups", {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
  });

  return parseJsonResponse(response);
}

export async function fetchUserGroupPicks() {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch("/api/user-group-picks", {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
  });

  return parseJsonResponse(response);
}

export async function saveUserGroupPicks(groupCodes) {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch("/api/user-group-picks", {
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
  const response = await fetch("/api/user-active-group", {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
  });

  return parseJsonResponse(response);
}

export async function setUserActiveGroup(groupCode, options = {}) {
  const authHeaders = await getApiAuthHeaders();
  const body = { groupCode };
  if (options.addToPicks) {
    body.addToPicks = true;
  }

  const response = await fetch("/api/user-active-group", {
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
