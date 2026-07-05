import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import PhotoWordCapture from "../components/PhotoWordCapture.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  fetchCompleteWordWithFallback,
  suggestionToFormValues,
} from "../features/words/completeWordApi.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { goBackToPreviousPage } from "../lib/navigation.js";
import { isMobileWebBrowser } from "../lib/pwaPlatform.js";

const initialFormValues = {
  term: "",
  definition: "",
  translation: "",
  pronunciation: "",
  partOfSpeech: "",
  example: "",
  exampleTranslation: "",
  tags: "",
};

function getInitialTab(searchParams) {
  return searchParams.get("tab") === "manual" ? "manual" : "photo";
}

function shouldAutoOpenCameraScan(searchParams) {
  if (searchParams.get("scan") !== "camera") {
    return false;
  }

  return Capacitor.isNativePlatform() || isMobileWebBrowser();
}

function AddWordPage() {
  const { locale, t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addWord, user, words } = useWordsContext();
  const [activeTab, setActiveTab] = useState(() => getInitialTab(searchParams));
  const wantsCameraScan = searchParams.get("scan") === "camera";
  const autoOpenCamera = shouldAutoOpenCameraScan(searchParams);
  const [formValues, setFormValues] = useState(initialFormValues);
  const [aiMessage, setAiMessage] = useState("");
  const [error, setError] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const termInputRef = useRef(null);

  useEffect(() => {
    setActiveTab(getInitialTab(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (!wantsCameraScan || autoOpenCamera) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("scan");
    nextParams.set("tab", "photo");
    setSearchParams(nextParams, { replace: true });
  }, [autoOpenCamera, searchParams, setSearchParams, wantsCameraScan]);

  useEffect(() => {
    if (activeTab !== "manual") {
      return;
    }

    termInputRef.current?.focus();
  }, [activeTab]);

  function handleAutoOpenCameraConsumed() {
    if (searchParams.get("scan") !== "camera") {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("scan");
    nextParams.set("tab", "photo");
    setSearchParams(nextParams, { replace: true });
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setSaveMessage("");
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  }

  function handleGoBack() {
    goBackToPreviousPage(navigate, location);
  }

  function resetFormForNextWord() {
    setFormValues(initialFormValues);
    setAiMessage("");

    requestAnimationFrame(() => {
      termInputRef.current?.focus();
    });
  }

  function handleTermKeyDown(event) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (!isAiLoading && !isSaving) {
      handleAiFill();
    }
  }

  async function handleAiFill() {
    const term = formValues.term.trim();

    if (!term) {
      setError(t("addWord.enterWordFirst"));
      return;
    }

    try {
      setError("");
      setSaveMessage("");
      setAiMessage("");
      setIsAiLoading(true);

      const result = await fetchCompleteWordWithFallback(term, locale, {
        user,
        localWords: words,
      });

      setFormValues((currentValues) => ({
        ...currentValues,
        ...suggestionToFormValues(result.suggestion),
      }));

      if (result.fromLocal) {
        setAiMessage(t("addWord.localSuccess"));
      } else if (result.fromWordbase) {
        setAiMessage(t("addWord.wordbaseSuccess"));
      } else if (result.usedFallback) {
        setAiMessage(t("addWord.aiFallback", { reason: result.fallbackReason }));
      } else {
        setAiMessage(t("addWord.aiSuccess"));
      }
    } finally {
      setIsAiLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formValues.term.trim() || !formValues.definition.trim()) {
      setError(t("addWord.requiredFields"));
      return;
    }

    try {
      setIsSaving(true);
      await addWord(formValues);
      setError("");
      setSaveMessage(t("addWord.saveSuccessNext"));
      resetFormForNextWord();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <div className="mb-8 text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {activeTab === "photo" ? t("addWord.photoEyebrow") : t("addWord.eyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          {activeTab === "photo" ? t("addWord.photoTitle") : t("addWord.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          {activeTab === "photo" ? t("addWord.photoDescription") : t("addWord.description")}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-1">
        <button
          className={[
            "rounded-xl px-4 py-3 text-sm font-bold transition",
            activeTab === "photo"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-blue-700",
          ].join(" ")}
          onClick={() => setActiveTab("photo")}
          type="button"
        >
          {t("addWord.tabPhoto")}
        </button>
        <button
          className={[
            "rounded-xl px-4 py-3 text-sm font-bold transition",
            activeTab === "manual"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-blue-700",
          ].join(" ")}
          onClick={() => setActiveTab("manual")}
          type="button"
        >
          {t("addWord.tabManual")}
        </button>
      </div>

      {activeTab === "photo" ? (
        <PhotoWordCapture
          autoOpenCamera={autoOpenCamera}
          onAutoOpenCameraConsumed={handleAutoOpenCameraConsumed}
        />
      ) : null}

      {activeTab === "manual" ? (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <button
            className="inline-flex rounded-full bg-blue-100 px-5 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
            onClick={handleGoBack}
            type="button"
          >
            {t("wordDetail.backToPrevious")}
          </button>

          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          {saveMessage ? (
            <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {saveMessage}
            </p>
          ) : null}

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.englishWord")}
            </span>
            <input
              ref={termInputRef}
              autoFocus
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="term"
              onChange={handleChange}
              onKeyDown={handleTermKeyDown}
              placeholder={t("addWord.placeholderTerm")}
              value={formValues.term}
            />
            <span className="mt-2 block text-sm text-slate-500">{t("addWord.termEnterHint")}</span>
          </label>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-blue-950">{t("addWord.aiTitle")}</h2>
                <p className="mt-1 text-sm text-slate-600">{t("addWord.aiDescription")}</p>
              </div>
              <button
                className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
                disabled={isAiLoading || isSaving}
                onClick={handleAiFill}
                type="button"
              >
                {isAiLoading ? t("addWord.aiFilling") : t("addWord.aiFill")}
              </button>
            </div>
            {aiMessage ? (
              <p className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                {aiMessage}
              </p>
            ) : null}
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.partOfSpeech")}
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="partOfSpeech"
              onChange={handleChange}
              placeholder={t("addWord.placeholderPos")}
              value={formValues.partOfSpeech}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.definition")}
            </span>
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="definition"
              onChange={handleChange}
              placeholder={t("addWord.placeholderDefinition")}
              value={formValues.definition}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.translation")}
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="translation"
              onChange={handleChange}
              placeholder={t("addWord.placeholderTranslation")}
              value={formValues.translation}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.pronunciation")}
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="pronunciation"
              onChange={handleChange}
              placeholder={t("addWord.placeholderPronunciation")}
              value={formValues.pronunciation}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.exampleSentence")}
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="example"
              onChange={handleChange}
              placeholder={t("addWord.placeholderExample")}
              value={formValues.example}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.exampleTranslation")}
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="exampleTranslation"
              onChange={handleChange}
              placeholder={t("addWord.placeholderExampleTranslation")}
              value={formValues.exampleTranslation}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">{t("addWord.tags")}</span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="tags"
              onChange={handleChange}
              placeholder={t("addWord.placeholderTags")}
              value={formValues.tags}
            />
            <span className="mt-2 block text-sm text-slate-500">{t("addWord.tagsHint")}</span>
          </label>

          <div className="flex justify-end">
            <button
              className="rounded-full bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:bg-slate-300"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? t("common.saving") : t("common.saveWord")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default AddWordPage;
