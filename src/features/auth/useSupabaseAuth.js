import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { isIosStandalonePwa } from "./authBootstrap.js";
import {
  cleanAuthCallbackUrl,
  clearPostAuthRedirect,
  completeAuthCallbackFromUrl,
  hasPendingAuthCallback,
  rememberPostAuthRedirect,
} from "./completeAuthCallback.js";
import { clearPkceVerifierBackup } from "./pkceStorage.js";
import {
  backupPkceVerifier,
  waitForPkceVerifier,
} from "./pkceStorage.js";
import { resolveAuthRedirectUrlAsync } from "./authRedirect.js";
import { hasSupabaseConfig, supabase } from "../../lib/supabaseClient.js";
import { isMobileWebBrowser } from "../../lib/pwaPlatform.js";

export function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(hasSupabaseConfig);
  const [authError, setAuthError] = useState("");
  const bootstrapCompleteRef = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return undefined;
    }

    let isMounted = true;
    const pendingCallback = hasPendingAuthCallback();

    void completeAuthCallbackFromUrl()
      .then(async ({ session: callbackSession, error }) => {
        if (!isMounted) {
          return;
        }

        bootstrapCompleteRef.current = true;

        if (error) {
          setAuthError(error.message);
        }

        if (callbackSession) {
          setSession(callbackSession);
          setAuthError("");
          setIsAuthLoading(false);
          return;
        }

        const { data, sessionError } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (sessionError) {
          setAuthError(sessionError.message);
        }

        setSession(data.session);
        setIsAuthLoading(false);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        bootstrapCompleteRef.current = true;
        setAuthError(error?.message || "Could not restore sign-in.");
        setIsAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      if (!bootstrapCompleteRef.current && pendingCallback && !nextSession) {
        return;
      }

      setSession(nextSession);

      if (bootstrapCompleteRef.current) {
        setIsAuthLoading(false);
      }

      if (nextSession) {
        setAuthError("");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || typeof window === "undefined") {
      return undefined;
    }

    function retryAuthCallback(event) {
      if (!event.persisted || !hasPendingAuthCallback()) {
        return;
      }

      void completeAuthCallbackFromUrl().then(({ session: callbackSession, error }) => {
        if (callbackSession) {
          setSession(callbackSession);
          setAuthError("");
          setIsAuthLoading(false);
          return;
        }

        if (error) {
          setAuthError(error.message);
          setIsAuthLoading(false);
        }
      });
    }

    window.addEventListener("pageshow", retryAuthCallback);

    return () => {
      window.removeEventListener("pageshow", retryAuthCallback);
    };
  }, []);

  const signInWithEmail = useCallback(async (email, { shouldCreateUser = true } = {}) => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error("Please enter your email address.");
    }

    setAuthError("");

    const emailRedirectTo = await resolveAuthRedirectUrlAsync({ strict: true });

    if (!emailRedirectTo) {
      throw new Error(
        "Auth redirect URL is not configured. Set VITE_AUTH_REDIRECT_URL and add it to Supabase Redirect URLs.",
      );
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo,
        shouldCreateUser,
      },
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const sendEmailSignInCode = useCallback(async (email, { shouldCreateUser = true } = {}) => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error("Please enter your email address.");
    }

    setAuthError("");

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser,
      },
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const verifyEmailSignInCode = useCallback(async (email, token) => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedToken = token.trim();

    if (!normalizedEmail) {
      throw new Error("Please enter your email address.");
    }

    if (!normalizedToken) {
      throw new Error("Please enter the code from your email.");
    }

    setAuthError("");

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: "email",
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }

    setSession(data.session);
    setAuthError("");
    return data.session;
  }, []);

  const signInWithOAuth = useCallback(async (provider, { postAuthRedirect = "/" } = {}) => {
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    if (isIosStandalonePwa()) {
      throw new Error("Google sign-in is not available in the iPhone home screen app.");
    }

    setAuthError("");

    const callbackUrl = await resolveAuthRedirectUrlAsync({ strict: true });

    if (!callbackUrl) {
      throw new Error(
        "Auth redirect URL is not configured. Set VITE_AUTH_REDIRECT_URL and add it to Supabase Redirect URLs.",
      );
    }

    const safePostAuthRedirect = postAuthRedirect.startsWith("/") ? postAuthRedirect : "/";
    rememberPostAuthRedirect(safePostAuthRedirect);

    const isMobileWeb = isMobileWebBrowser();
    const useManualRedirect = Capacitor.isNativePlatform() || isIosStandalonePwa() || isMobileWeb;
    const options = {
      redirectTo: callbackUrl,
      skipBrowserRedirect: useManualRedirect,
    };

    if (provider === "google") {
      options.queryParams = {
        prompt: "select_account",
      };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options,
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }

    if (useManualRedirect && data?.url) {
      if (isMobileWeb) {
        const hasVerifier = await waitForPkceVerifier();

        if (!hasVerifier) {
          throw new Error(
            "Could not start Google sign-in on this device. Use the email code below.",
          );
        }

        backupPkceVerifier();
      }

      window.location.assign(data.url);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setAuthError("");
    setSession(null);
    setIsAuthLoading(false);
    clearPostAuthRedirect();
    clearPkceVerifierBackup();
    cleanAuthCallbackUrl();

    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError("");
  }, []);

  return {
    authError,
    clearAuthError,
    hasSupabaseConfig,
    isAuthLoading,
    session,
    signInWithEmail,
    signInWithOAuth,
    sendEmailSignInCode,
    verifyEmailSignInCode,
    signOut,
    user: session?.user ?? null,
  };
}
