import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  navigateAfterAuth,
  shouldHardNavigateAfterAuth,
  waitForPersistedSession,
} from "../features/auth/authBootstrap.js";
import {
  hasPendingAuthCallback,
  resolvePostAuthRedirect,
} from "../features/auth/completeAuthCallback.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";

function AuthCallbackPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authError, isAuthLoading, user } = useWordsContext();
  const redirectTo = resolvePostAuthRedirect(searchParams.get("redirect") || "/");
  const pendingCallback = hasPendingAuthCallback();
  const hasCompletedRedirectRef = useRef(false);

  useEffect(() => {
    if (hasCompletedRedirectRef.current) {
      return;
    }

    if (isAuthLoading || pendingCallback) {
      return;
    }

    if (user) {
      hasCompletedRedirectRef.current = true;

      void waitForPersistedSession().then((persistedSession) => {
        if (!persistedSession) {
          hasCompletedRedirectRef.current = false;
          return;
        }

        if (shouldHardNavigateAfterAuth()) {
          navigateAfterAuth(redirectTo);
          return;
        }

        navigate(redirectTo, { replace: true });
      });

      return;
    }

    const errorDescription =
      authError ||
      searchParams.get("error_description") ||
      searchParams.get("error");

    if (errorDescription) {
      hasCompletedRedirectRef.current = true;
      navigate(`/auth?mode=login&redirect=${encodeURIComponent(redirectTo)}`, {
        replace: true,
        state: { authError: errorDescription },
      });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      hasCompletedRedirectRef.current = true;
      navigate(`/auth?mode=login&redirect=${encodeURIComponent(redirectTo)}`, {
        replace: true,
        state: {
          authError: "Sign-in timed out. Please try again.",
        },
      });
    }, 15000);

    return () => window.clearTimeout(timeoutId);
  }, [authError, isAuthLoading, navigate, pendingCallback, redirectTo, searchParams, user]);

  return (
    <section className="flex min-h-[70svh] w-full max-w-lg items-center justify-center px-4">
      <p className="text-sm font-medium text-slate-600">{t("auth.completingLogin")}</p>
    </section>
  );
}

export default AuthCallbackPage;
