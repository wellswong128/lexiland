import { Capacitor } from "@capacitor/core";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// Web browsers should let Supabase detect OAuth callbacks in the URL.
// Native Capacitor shells receive auth codes via deep links instead.
export const usesAutoSessionDetection = !Capacitor.isNativePlatform();

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: usesAutoSessionDetection,
        flowType: "pkce",
        persistSession: true,
      },
    })
  : null;
