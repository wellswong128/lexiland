import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  navigateAfterAuth,
  shouldHardNavigateAfterAuth,
  waitForPersistedSession,
} from "../features/auth/authBootstrap.js";
import {
  cleanAuthCallbackUrl,
  clearPostAuthRedirect,
  hasPendingAuthCallback,
  resolvePostAuthRedirect,
} from "../features/auth/completeAuthCallback.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const CALLBACK_TIMEOUT_MS = 15000;

function AuthCallbackPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authError, isAuthLoading, user } = useWordsContext();
  const redirectToRef = useRef(null);
  if (redirectToRef.current === null) {
    redirectToRef.current = resolvePostAuthRedirect(searchParams.get("redirect") || "/");
  }
  const redirectTo = redirectToRef.current;
  const hasCompletedRedirectRef = useRef(false);

  function redirectToLogin(errorMessage) {
    if (hasCompletedRedirectRef.current) {
      return;
    }

    hasCompletedRedirectRef.current = true;
    cleanAuthCallbackUrl();
    navigate(`/auth?mode=login&redirect=${encodeURIComponent(redirectTo)}`, {
      replace: true,
      state: errorMessage ? { authError: errorMessage } : null,
    });
  }

  useEffect(() => {
    if (hasCompletedRedirectRef.current || isAuthLoading || user) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      redirectToLogin("Sign-in timed out. Please try again.");
    }, CALLBACK_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isAuthLoading, navigate, redirectTo, user]);

  useEffect(() => {
    if (hasCompletedRedirectRef.current || isAuthLoading) {
      return;
    }

    if (user) {
      hasCompletedRedirectRef.current = true;
      clearPostAuthRedirect();

      if (shouldHardNavigateAfterAuth()) {
        void waitForPersistedSession().then((persistedSession) => {
          if (!persistedSession) {
            hasCompletedRedirectRef.current = false;
            return;
          }

          navigateAfterAuth(redirectTo);
        });
        return;
      }

      navigate(redirectTo, { replace: true });
      return;
    }

    const errorDescription =
      authError ||
      searchParams.get("error_description") ||
      searchParams.get("error");

    if (errorDescription) {
      redirectToLogin(errorDescription);
      return;
    }

    if (!hasPendingAuthCallback()) {
      redirectToLogin("Sign-in timed out. Please try again.");
    }
  }, [authError, isAuthLoading, navigate, redirectTo, searchParams, user]);

  return (
    <section className="flex min-h-[70svh] w-full max-w-lg items-center justify-center px-4">
      <p className="text-sm font-medium text-slate-600">{t("auth.completingLogin")}</p>
    </section>
  );
}

export default AuthCallbackPage;
