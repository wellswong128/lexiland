import { useState } from "react";
import { WORDS_STORAGE_KEY } from "../lib/storage.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";

function SettingsPage() {
  const {
    authError,
    hasSupabaseConfig,
    isAuthLoading,
    isUsingSupabase,
    resetAllWords,
    signInWithEmail,
    signOut,
    user,
    words,
    wordsError,
  } = useWordsContext();
  const [email, setEmail] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSignIn(event) {
    event.preventDefault();

    if (!email.trim()) {
      setMessage("Please enter your email address.");
      return;
    }

    try {
      setIsAuthSubmitting(true);
      await signInWithEmail(email.trim());
      setMessage("Check your email for the Supabase login link.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      setIsAuthSubmitting(true);
      await signOut();
      setMessage("Signed out. The app is using local browser data now.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleReset() {
    const shouldReset = window.confirm(
      "Delete all current LexiLoop words? This cannot be undone.",
    );

    if (!shouldReset) {
      return;
    }

    try {
      setIsResetting(true);
      await resetAllWords();
      setMessage("All words were deleted.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <section className="w-full max-w-4xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <div className="mb-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          App Preferences
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          Settings
        </h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Manage storage for this MVP. Signed-in users use Supabase; otherwise
          this browser keeps using local data.
        </p>
      </div>

      {message ? (
        <p className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </p>
      ) : null}

      {authError || wordsError ? (
        <p className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {authError || wordsError}
        </p>
      ) : null}

      <div className="mb-5 rounded-2xl bg-blue-50 p-5">
        <h2 className="text-lg font-bold text-blue-950">Supabase Account</h2>
        {!hasSupabaseConfig ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Supabase environment variables are not configured, so the app is
            using localStorage.
          </p>
        ) : isAuthLoading ? (
          <p className="mt-2 text-sm text-slate-600">Checking session...</p>
        ) : user ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">
              Signed in as <span className="font-bold">{user.email}</span>.
            </p>
            <button
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:bg-slate-300"
              disabled={isAuthSubmitting}
              onClick={handleSignOut}
              type="button"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSignIn}>
            <input
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
            <button
              className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
              disabled={isAuthSubmitting}
              type="submit"
            >
              {isAuthSubmitting ? "Sending..." : "Email Login Link"}
            </button>
          </form>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl bg-blue-50 p-5">
          <h2 className="text-lg font-bold text-blue-950">Current Storage</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-bold text-blue-700">Mode</dt>
              <dd className="mt-1 text-slate-700">
                {isUsingSupabase ? "Supabase" : "localStorage"}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-blue-700">Local Fallback Key</dt>
              <dd className="mt-1 break-all text-slate-700">
                {WORDS_STORAGE_KEY}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-blue-700">Saved Words</dt>
              <dd className="mt-1 text-slate-700">{words.length}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <h2 className="text-lg font-bold text-red-800">Danger Zone</h2>
          <p className="mt-2 text-sm leading-6 text-red-700">
            Resetting data removes all words, review progress, and mistake
            history from this browser.
          </p>
          <button
            className="mt-5 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:bg-slate-300"
            disabled={words.length === 0 || isResetting}
            onClick={handleReset}
            type="button"
          >
            {isResetting ? "Resetting..." : "Reset Current Data"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default SettingsPage;
