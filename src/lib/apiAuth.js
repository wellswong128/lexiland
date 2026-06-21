import { supabase } from "./supabaseClient.js";

const TOKEN_CACHE_TTL_MS = 30_000;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

export async function getApiAuthHeaders() {
  if (!supabase) {
    return {};
  }

  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt) {
    return {
      Authorization: `Bearer ${cachedToken}`,
    };
  }

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) {
      cachedToken = null;
      cachedTokenExpiresAt = 0;
      return {};
    }

    cachedToken = token;
    cachedTokenExpiresAt = now + TOKEN_CACHE_TTL_MS;

    return {
      Authorization: `Bearer ${token}`,
    };
  } catch {
    cachedToken = null;
    cachedTokenExpiresAt = 0;
    return {};
  }
}
