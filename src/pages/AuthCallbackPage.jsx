import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";

function AuthCallbackPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authError, isAuthLoading, user } = useWordsContext();
  const redirectTo = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (user) {
      navigate(redirectTo, { replace: true });
      return;
    }

    const errorDescription = searchParams.get("error_description") || searchParams.get("error");
    if (errorDescription) {
      navigate(`/auth?mode=login&redirect=${encodeURIComponent(redirectTo)}`, {
        replace: true,
        state: { authError: errorDescription },
      });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate(`/auth?mode=login&redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [authError, isAuthLoading, navigate, redirectTo, searchParams, user]);

  return (
    <section className="flex min-h-[70svh] w-full max-w-lg items-center justify-center px-4">
      <p className="text-sm font-medium text-slate-600">{t("auth.completingLogin")}</p>
    </section>
  );
}

export default AuthCallbackPage;
