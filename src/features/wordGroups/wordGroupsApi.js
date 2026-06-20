import { getApiAuthHeaders } from "../../lib/apiAuth.js";

async function parseJsonResponse(response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
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

export async function setUserActiveGroup(groupCode) {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch("/api/user-active-group", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({ groupCode }),
  });

  return parseJsonResponse(response);
}
