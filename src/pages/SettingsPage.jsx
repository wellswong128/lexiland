import { useEffect, useMemo, useState } from "react";
import LanguageToggle from "../components/LanguageToggle.jsx";
import {
  isLocalhostUrl,
  resolveAuthRedirectUrl,
} from "../features/auth/authRedirect.js";
import { getFriendlyAuthError } from "../features/auth/authErrors.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { normalizeTerm, normalizeText } from "../features/words/wordTypes.js";
import { loadWords, WORDS_STORAGE_KEY } from "../lib/storage.js";

const EMAIL_COOLDOWN_SECONDS = 60;

function SettingsPage() {
  const { t } = useLocale();
  const {
    authError,
    hasSupabaseConfig,
    isAuthLoading,
    isUsingSupabase,
    resetAllWords,
    signInWithEmail,
    signOut,
    syncLocalWordsToSupabase,
    user,
    words,
    wordsError,
  } = useWordsContext();
  const [email, setEmail] = useState("");
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

  useEffect(() => {
    if (emailCooldown <= 0) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setEmailCooldown((currentSeconds) => Math.max(currentSeconds - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [emailCooldown]);

  async function handleSignIn(event) {
    event.preventDefault();

    if (!email.trim()) {
      setNoticeType("error");
      setNotice(t("settings.enterEmail"));
      return;
    }

    if (emailCooldown > 0) {
      setNoticeType("error");
      setNotice(t("settings.waitCooldown", { seconds: emailCooldown }));
      return;
    }

    try {
      setIsAuthSubmitting(true);
      await signInWithEmail(email.trim());
      setNoticeType("success");
      setNotice(t("settings.checkEmail"));
      setEmailCooldown(EMAIL_COOLDOWN_SECONDS);
    } catch (error) {
      setNoticeType("error");
      setNotice(getFriendlyAuthError(error.message, t));
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      setIsAuthSubmitting(true);
      await signOut();
      setNoticeType("success");
      setNotice(t("settings.signedOut"));
    } catch (error) {
      setNoticeType("error");
      setNotice(error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleReset() {
    const shouldReset = window.confirm(t("settings.resetConfirm"));

    if (!shouldReset) {
      return;
    }

    try {
      setIsResetting(true);
      await resetAllWords();
      setNoticeType("success");
      setNotice(t("settings.resetSuccess"));
    } catch (error) {
      setNoticeType("error");
      setNotice(error.message);
    } finally {
      setIsResetting(false);
    }
  }

  const pendingLocalWordCount = useMemo(() => {
    const cloudTerms = new Set(words.map((word) => normalizeTerm(word.term)));

    return loadWords().filter((word) => {
      const term = normalizeTerm(word.term);
      const definition = normalizeText(word.definition);

      return term && definition && !cloudTerms.has(term);
    }).length;
  }, [words, notice, isSyncingLocal]);

  async function handleSyncLocal() {
    if (!user) {
      setNoticeType("error");
      setNotice(t("settings.syncLocalSignInRequired"));
      return;
    }

    if (pendingLocalWordCount === 0) {
      setNoticeType("error");
      setNotice(t("settings.syncLocalEmpty"));
      return;
    }

    try {
      setIsSyncingLocal(true);
      const result = await syncLocalWordsToSupabase();

      setNoticeType("success");
      setNotice(
        t("settings.syncLocalSuccess", {
          imported: result.importedWords.length,
          skipped: result.skippedWords.length,
        }),
      );
    } catch (error) {
      setNoticeType("error");
      setNotice(error.message);
    } finally {
      setIsSyncingLocal(false);
    }
  }

  const currentError = authError || wordsError;
  const friendlyCurrentError = currentError
    ? getFriendlyAuthError(currentError, t)
    : "";
  const authRedirectUrl = resolveAuthRedirectUrl();
  const hasLocalRedirectConfig = isLocalhostUrl(
    import.meta.env.VITE_AUTH_REDIRECT_URL || "",
  );

  return (
    <section className="w-full max-w-4xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <div className="mb-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {t("settings.eyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          {t("settings.title")}
        </h1>
        <p className="mt-4 max-w-2xl text-slate-600">{t("settings.description")}</p>
      </div>

      {notice ? (
        <p
          className={[
            "mb-6 rounded-2xl border px-4 py-3 text-sm font-medium",
            noticeType === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {notice}
        </p>
      ) : null}

      {friendlyCurrentError && friendlyCurrentError !== notice ? (
        <p className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {friendlyCurrentError}
        </p>
      ) : null}

      <div className="mb-5 rounded-2xl bg-blue-50 p-5">
        <h2 className="text-lg font-bold text-blue-950">{t("language.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t("language.description")}
        </p>
        <div className="mt-4">
          <LanguageToggle />
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-blue-50 p-5">
        <h2 className="text-lg font-bold text-blue-950">{t("settings.supabaseAccount")}</h2>
        {!hasSupabaseConfig ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t("settings.noSupabaseConfig")}
          </p>
        ) : isAuthLoading ? (
          <p className="mt-2 text-sm text-slate-600">{t("settings.checkingSession")}</p>
        ) : user ? (
          <>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-700">
                {t("settings.signedInAs", { email: user.email })}
              </p>
              <button
                className="rounded-full bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:bg-slate-300"
                disabled={isAuthSubmitting}
                onClick={handleSignOut}
                type="button"
              >
                {t("settings.signOut")}
              </button>
            </div>

            {pendingLocalWordCount > 0 ? (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4">
                <h3 className="text-base font-bold text-blue-950">
                  {t("settings.syncLocalTitle")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {t("settings.syncLocalDescription")}
                </p>
                <p className="mt-3 text-sm font-semibold text-blue-900">
                  {t("settings.syncLocalCount", { count: pendingLocalWordCount })}
                </p>
                <button
                  className="mt-4 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
                  disabled={isSyncingLocal}
                  onClick={handleSyncLocal}
                  type="button"
                >
                  {isSyncingLocal
                    ? t("settings.syncLocalUploading")
                    : t("settings.syncLocalButton")}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">
              {t("settings.loginRedirect")}{" "}
              <span className="font-semibold text-blue-950">
                {authRedirectUrl || t("settings.notConfigured")}
              </span>
            </p>
            {hasLocalRedirectConfig ? (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t("settings.localhostWarning")}
              </p>
            ) : null}
            <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSignIn}>
              <input
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("settings.emailPlaceholder")}
                type="email"
                value={email}
              />
              <button
                className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
                disabled={isAuthSubmitting || emailCooldown > 0}
                type="submit"
              >
                {isAuthSubmitting
                  ? t("settings.sending")
                  : emailCooldown > 0
                    ? t("settings.tryAgainIn", { seconds: emailCooldown })
                    : t("settings.emailLoginLink")}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl bg-blue-50 p-5">
          <h2 className="text-lg font-bold text-blue-950">{t("settings.currentStorage")}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-bold text-blue-700">{t("settings.mode")}</dt>
              <dd className="mt-1 text-slate-700">
                {isUsingSupabase ? "Supabase" : "localStorage"}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-blue-700">{t("settings.localFallbackKey")}</dt>
              <dd className="mt-1 break-all text-slate-700">{WORDS_STORAGE_KEY}</dd>
            </div>
            <div>
              <dt className="font-bold text-blue-700">{t("settings.savedWords")}</dt>
              <dd className="mt-1 text-slate-700">{words.length}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <h2 className="text-lg font-bold text-red-800">{t("settings.dangerZone")}</h2>
          <p className="mt-2 text-sm leading-6 text-red-700">
            {t("settings.dangerDescription")}
          </p>
          <button
            className="mt-5 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:bg-slate-300"
            disabled={words.length === 0 || isResetting}
            onClick={handleReset}
            type="button"
          >
            {isResetting ? t("settings.resetting") : t("settings.resetData")}
          </button>
        </div>
      </div>
    </section>
  );
}

export default SettingsPage;
