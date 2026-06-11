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

    if (typeof window !== "undefined") {
      const hashParams = window.location.hash.startsWith("#")
        ? new URLSearchParams(window.location.hash.slice(1))
        : new URLSearchParams();
      const authCallbackError =
        hashParams.get("error_description") || hashParams.get("error");

      if (authCallbackError) {
        setAuthError(decodeURIComponent(authCallbackError.replace(/\+/g, " ")));
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}${window.location.search}`,
        );
      }
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session);
      setIsAuthLoading(false);

      if (
        typeof window !== "undefined" &&
        data.session &&
        (window.location.search.includes("code=") ||
          window.location.hash.includes("access_token="))
      ) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);
      if (nextSession) {
        setAuthError("");
      }
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

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error("Please enter your email address.");
    }

    setAuthError("");

    const emailRedirectTo = resolveAuthRedirectUrl({ strict: true });

    if (!emailRedirectTo) {
      throw new Error(
        "Auth redirect URL is not configured. Set VITE_AUTH_REDIRECT_URL and add it to Supabase Redirect URLs.",
      );
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
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
