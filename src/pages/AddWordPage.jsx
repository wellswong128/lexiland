import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const initialFormValues = {
  term: "",
  definition: "",
  translation: "",
  pronunciation: "",
  partOfSpeech: "",
  example: "",
  tags: "",
};

function createDemoSuggestion(term) {
  const normalizedTerm = term.trim();

  return {
    term: normalizedTerm,
    definition: `A demo vocabulary card for "${normalizedTerm}". Replace this with the real definition before saving.`,
    translation: "示範翻譯",
    pronunciation: "",
    partOfSpeech: "word",
    example: `I am learning how to use "${normalizedTerm}" in a sentence.`,
    tags: ["demo", "ai-fallback"],
  };
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    throw new Error(
      "AI service returned an empty response. Check the Vercel function logs and AGNES_API_KEY.",
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "AI service did not return JSON. If you are testing locally, run through Vercel or deploy the latest version.",
    );
  }
}

function AddWordPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { addWord } = useWordsContext();
  const [formValues, setFormValues] = useState(initialFormValues);
  const [aiMessage, setAiMessage] = useState("");
  const [error, setError] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  }

  async function handleAiFill() {
    const term = formValues.term.trim();

    if (!term) {
      setError(t("addWord.enterWordFirst"));
      return;
    }

    function applySuggestion(suggestion) {
      setFormValues((currentValues) => ({
        ...currentValues,
        term: suggestion.term || currentValues.term,
        definition: suggestion.definition || currentValues.definition,
        translation: suggestion.translation || currentValues.translation,
        pronunciation: suggestion.pronunciation || currentValues.pronunciation,
        partOfSpeech: suggestion.partOfSpeech || currentValues.partOfSpeech,
        example: suggestion.example || currentValues.example,
        tags: Array.isArray(suggestion.tags)
          ? suggestion.tags.join(", ")
          : currentValues.tags,
      }));
    }

    try {
      setError("");
      setAiMessage("");
      setIsAiLoading(true);

      const response = await fetch("/api/complete-word", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ term }),
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "AI Fill failed.");
      }

      applySuggestion(data.suggestion);
      setAiMessage(t("addWord.aiSuccess"));
    } catch (aiError) {
      applySuggestion(createDemoSuggestion(term));
      setError("");
      setAiMessage(t("addWord.aiFallback", { reason: aiError.message }));
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
      navigate("/words");
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
          {t("addWord.eyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          {t("addWord.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          {t("addWord.description")}
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
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

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.englishWord")}
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="term"
              onChange={handleChange}
              placeholder={t("addWord.placeholderTerm")}
              value={formValues.term}
            />
          </label>

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
        </div>

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

        <div className="grid gap-5 sm:grid-cols-2">
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
        </div>

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
            {t("addWord.tags")}
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            name="tags"
            onChange={handleChange}
            placeholder={t("addWord.placeholderTags")}
            value={formValues.tags}
          />
          <span className="mt-2 block text-sm text-slate-500">
            {t("addWord.tagsHint")}
          </span>
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
    </section>
  );
}

export default AddWordPage;
