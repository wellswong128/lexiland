import { supabase } from "./supabaseClient.js";

export async function getApiAuthHeaders() {
  if (!supabase) {
    return {};
  }

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;

    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return {};
  }
}
