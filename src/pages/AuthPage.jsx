import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import LexiMascot from "../components/LexiMascot.jsx";
import { getFriendlyAuthError } from "../features/auth/authErrors.js";
import {
  getSafeAuthRedirectPath,
  isIosStandalonePwa,
  navigateAfterPersistedSession,
  shouldHardNavigateAfterAuth,
} from "../features/auth/authBootstrap.js";
import { resolveAuthRedirectUrl } from "../features/auth/authRedirect.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { canRoute, ROLES } from "../lib/authorization.js";

const EMAIL_COOLDOWN_SECONDS = 60;

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#fff"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#fff"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#fff"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#fff"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <rect height="16" rx="2" width="20" x="2" y="4" />
      <path d="m22 7-8.97 5.7a2 2 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function AuthHero() {
  const { t } = useLocale();

  return (
    <div className="relative mx-auto mb-8 flex w-full max-w-[17rem] flex-col items-center justify-center">
      <div className="relative">
        <div className="absolute -right-3 -top-2 size-16 rotate-12 rounded-full bg-amber-200/80 blur-[1px]" />
        <div className="auth-mascot-card relative px-2 py-2">
          <LexiMascot className="lexi-mascot-auth" size="lg" title={t("brand.mascotAlt")} />
        </div>
      </div>
      <p className="auth-mascot-name mt-3 text-sm font-bold">{t("brand.mascotName")}</p>
    </div>
  );
}

function AuthPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    authError,
    hasSupabaseConfig,
    isAuthLoading,
    sendEmailSignInCode,
    signInWithEmail,
    signInWithOAuth,
    verifyEmailSignInCode,
    user,
  } = useWordsContext();

  const isIosPwa = isIosStandalonePwa();

  const mode = searchParams.get("mode") === "login" ? "login" : "signup";
  const redirectTo = getSafeAuthRedirectPath(searchParams.get("redirect") || "/");
  const isSignup = mode === "signup";
  const hasCompletedRedirectRef = useRef(false);
  const continueWithoutAccountTo = useMemo(() => {
    if (canRoute(ROLES.GUEST, redirectTo)) {
      return redirectTo;
    }

    return "/";
  }, [redirectTo]);

  const [showEmailForm, setShowEmailForm] = useState(isIosStandalonePwa());
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

  useEffect(() => {
    if (isAuthLoading || !user || hasCompletedRedirectRef.current) {
      return undefined;
    }

    hasCompletedRedirectRef.current = true;

    if (shouldHardNavigateAfterAuth()) {
      let isCancelled = false;

      void navigateAfterPersistedSession(redirectTo)
        .then((didNavigate) => {
          if (!didNavigate && !isCancelled) {
            hasCompletedRedirectRef.current = false;
          }
        })
        .catch((error) => {
          if (isCancelled) {
            return;
          }

          hasCompletedRedirectRef.current = false;
          setNoticeType("error");
          setNotice(getFriendlyAuthError(error?.message || "Could not restore sign-in.", t));
        });

      return () => {
        isCancelled = true;
      };
    }

    navigate(redirectTo, { replace: true });
    return undefined;
  }, [isAuthLoading, navigate, redirectTo, t, user]);

  useEffect(() => {
    if (emailCooldown <= 0) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setEmailCooldown((currentSeconds) => Math.max(currentSeconds - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [emailCooldown]);

  useEffect(() => {
    const hash = window.location.hash;
    const isAuthFragment =
      hash.includes("access_token=") ||
      hash.includes("error=") ||
      hash.includes("error_description=");

    if (hash && !isAuthFragment) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  useEffect(() => {
    if (!location.state?.authError) {
      return;
    }

    setNoticeType("error");
    setNotice(getFriendlyAuthError(String(location.state.authError), t));
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, t]);

  useEffect(() => {
    setShowEmailForm(isIosPwa);
    setNotice("");
    setEmail("");
    setEmailCode("");
    setEmailCodeSent(false);
  }, [isIosPwa, mode]);

  const nativeRedirectUrl = Capacitor.isNativePlatform() ? resolveAuthRedirectUrl() : "";

  useEffect(() => {
    const lower = (authError || "").toLowerCase();
    if (
      lower.includes("error getting user email from external provider") ||
      lower.includes("error getting user profile from external provider")
    ) {
      setShowEmailForm(true);
    }
  }, [authError]);

  function switchMode(nextMode) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mode", nextMode);
    setSearchParams(nextParams, { replace: true });
  }

  async function handleOAuth(provider) {
    try {
      setIsSubmitting(true);
      setNotice("");
      await signInWithOAuth(provider);
    } catch (error) {
      setNoticeType("error");
      setNotice(getFriendlyAuthError(error.message, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();

    if (!email.trim()) {
      setNoticeType("error");
      setNotice(t("settings.enterEmail"));
      return;
    }

    if (isIosPwa && emailCodeSent) {
      if (!emailCode.trim()) {
        setNoticeType("error");
        setNotice(t("auth.enterEmailCode"));
        return;
      }

      try {
        setIsSubmitting(true);
        setNotice("");
        await verifyEmailSignInCode(email.trim(), emailCode.trim());
      } catch (error) {
        setNoticeType("error");
        setNotice(getFriendlyAuthError(error.message, t));
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (emailCooldown > 0) {
      setNoticeType("error");
      setNotice(t("settings.waitCooldown", { seconds: emailCooldown }));
      return;
    }

    try {
      setIsSubmitting(true);
      setNotice("");

      if (isIosPwa) {
        await sendEmailSignInCode(email.trim(), { shouldCreateUser: isSignup });
        setEmailCodeSent(true);
        setEmailCode("");
        setNoticeType("success");
        setNotice(isSignup ? t("auth.emailCodeSentSignup") : t("auth.emailCodeSentLogin"));
      } else {
        await signInWithEmail(email.trim(), { shouldCreateUser: isSignup });
        setNoticeType("success");
        setNotice(isSignup ? t("auth.emailSentSignup") : t("auth.emailSentLogin"));
      }

      setEmailCooldown(EMAIL_COOLDOWN_SECONDS);
    } catch (error) {
      setNoticeType("error");
      setNotice(getFriendlyAuthError(error.message, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  const friendlyAuthError = authError ? getFriendlyAuthError(authError, t) : "";

  if (isAuthLoading) {
    return (
      <section className="flex min-h-[70svh] w-full max-w-lg items-center justify-center px-4">
        <p className="text-sm font-medium text-slate-600">{t("settings.checkingSession")}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-8 sm:py-12">
      <AuthHero />

      <div className="w-full text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {isSignup ? t("auth.signupHeadline") : t("auth.loginHeadline")}
        </h1>
        <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          {isSignup ? t("auth.signupSubheadline") : t("auth.loginSubheadline")}
        </p>
        {isSignup ? (
          <p className="mx-auto mt-4 max-w-sm text-xs leading-5 text-slate-500">
            {t("auth.termsNotice")}
          </p>
        ) : null}
      </div>

      {!hasSupabaseConfig ? (
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("settings.noSupabaseConfig")}
        </p>
      ) : null}

      {notice ? (
        <p
          className={[
            "mt-6 w-full rounded-2xl border px-4 py-3 text-sm font-medium",
            noticeType === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {notice}
        </p>
      ) : null}

      {friendlyAuthError && friendlyAuthError !== notice ? (
        <p className="mt-6 w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 whitespace-pre-line">
          {friendlyAuthError}
        </p>
      ) : null}

      {nativeRedirectUrl ? (
        <p className="mt-4 w-full rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
          {t("auth.nativeRedirectDebug", { url: nativeRedirectUrl })}
        </p>
      ) : null}

      {isIosPwa ? (
        <p className="mt-6 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {t("auth.pwaIosNotice")}
        </p>
      ) : null}

      {hasSupabaseConfig ? (
        <div className="mt-8 w-full space-y-3">
          {!showEmailForm ? (
            <>
              <button
                className="flex w-full items-center justify-center gap-3 rounded-full bg-[#4285F4] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#3367D6] disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => handleOAuth("google")}
                type="button"
              >
                <GoogleIcon />
                {t("auth.continueGoogle")}
              </button>

              <button
                className="flex w-full items-center justify-center gap-3 rounded-full bg-[#F0F2F7] px-5 py-3.5 text-sm font-bold text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => setShowEmailForm(true)}
                type="button"
              >
                <MailIcon />
                {isSignup ? t("auth.signupEmail") : t("auth.loginEmail")}
              </button>
            </>
          ) : (
            <form className="space-y-3" onSubmit={handleEmailSubmit}>
              <input
                autoComplete="email"
                className="w-full rounded-full border border-slate-200 bg-white px-5 py-3.5 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("settings.emailPlaceholder")}
                type="email"
                value={email}
              />
              {isIosPwa && emailCodeSent ? (
                <input
                  autoComplete="one-time-code"
                  className="w-full rounded-full border border-slate-200 bg-white px-5 py-3.5 text-center text-lg tracking-[0.35em] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(event) => setEmailCode(event.target.value.replace(/\s+/g, ""))}
                  placeholder={t("auth.emailCodePlaceholder")}
                  type="text"
                  value={emailCode}
                />
              ) : null}
              <button
                className="w-full rounded-full bg-blue-700 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
                disabled={isSubmitting || (!isIosPwa && emailCooldown > 0) || (isIosPwa && !emailCodeSent && emailCooldown > 0)}
                type="submit"
              >
                {isSubmitting
                  ? t("settings.sending")
                  : isIosPwa && emailCodeSent
                    ? t("auth.verifyEmailCode")
                    : isIosPwa
                      ? emailCooldown > 0
                        ? t("settings.tryAgainIn", { seconds: emailCooldown })
                        : isSignup
                          ? t("auth.sendEmailCodeSignup")
                          : t("auth.sendEmailCodeLogin")
                      : emailCooldown > 0
                        ? t("settings.tryAgainIn", { seconds: emailCooldown })
                        : isSignup
                          ? t("auth.sendSignupLink")
                          : t("auth.sendLoginLink")}
              </button>
              {!isIosPwa ? (
                <button
                  className="w-full py-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
                  onClick={() => setShowEmailForm(false)}
                  type="button"
                >
                  {t("auth.backToOptions")}
                </button>
              ) : null}
            </form>
          )}
        </div>
      ) : null}

      <p className="mt-8 text-sm text-slate-700">
        {isSignup ? t("auth.hasAccount") : t("auth.noAccount")}{" "}
        <button
          className="font-bold text-blue-700 transition hover:text-blue-900"
          onClick={() => switchMode(isSignup ? "login" : "signup")}
          type="button"
        >
          {isSignup ? t("auth.loginLink") : t("auth.signupLink")}
        </button>
      </p>

      <Link
        className="mt-6 text-sm font-semibold text-slate-500 transition hover:text-blue-700"
        to={continueWithoutAccountTo}
      >
        {t("auth.continueWithoutAccount")}
      </Link>
    </section>
  );
}

export default AuthPage;
