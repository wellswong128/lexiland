import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

function AddWordPage() {
  const navigate = useNavigate();
  const { addWord } = useWordsContext();
  const [formValues, setFormValues] = useState(initialFormValues);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formValues.term.trim() || !formValues.definition.trim()) {
      setError("Please enter both an English word and a definition.");
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
          New Vocabulary
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          Add Word
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Save a word now. Flashcards and quizzes will use this data later.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              English word
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="term"
              value={formValues.term}
              onChange={handleChange}
              placeholder="resilient"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Part of speech
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="partOfSpeech"
              value={formValues.partOfSpeech}
              onChange={handleChange}
              placeholder="adjective"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Definition
          </span>
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            name="definition"
            value={formValues.definition}
            onChange={handleChange}
            placeholder="Able to recover quickly from difficulty."
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Translation
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="translation"
              value={formValues.translation}
              onChange={handleChange}
              placeholder="Optional"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Pronunciation
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="pronunciation"
              value={formValues.pronunciation}
              onChange={handleChange}
              placeholder="/ri-ZIL-yent/"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Example sentence
          </span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            name="example"
            value={formValues.example}
            onChange={handleChange}
            placeholder="She is resilient after every setback."
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Tags
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            name="tags"
            value={formValues.tags}
            onChange={handleChange}
            placeholder="advanced, personality"
          />
          <span className="mt-2 block text-sm text-slate-500">
            Separate tags with commas.
          </span>
        </label>

        <div className="flex justify-end">
          <button
            className="rounded-full bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:bg-slate-300"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save Word"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default AddWordPage;
