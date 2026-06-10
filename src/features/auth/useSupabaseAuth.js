import { useCallback, useEffect, useState } from "react";
import { resolveAuthRedirectUrl } from "./authRedirect.js";
import { hasSupabaseConfig, supabase } from "../../lib/supabaseClient.js";

export function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(hasSupabaseConfig);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session);
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);
      setAuthError("");
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email) => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    setAuthError("");

    const emailRedirectTo = resolveAuthRedirectUrl({ strict: true });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setAuthError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  return {
    authError,
    hasSupabaseConfig,
    isAuthLoading,
    session,
    signInWithEmail,
    signOut,
    user: session?.user ?? null,
  };
}
