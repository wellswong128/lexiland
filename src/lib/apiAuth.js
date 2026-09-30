import { supabase } from "./supabaseClient.js";
import { buildApiAuthHeaders } from "./apiAuthHeaders.js";

export async function getApiAuthHeaders(options = {}) {
  if (!supabase) {
    return {};
  }

  try {
    const { data } = await supabase.auth.getSession();
    return buildApiAuthHeaders(data?.session, options);
  } catch {
    return {};
  }
}
