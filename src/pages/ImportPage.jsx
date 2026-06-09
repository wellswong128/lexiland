import { useState } from "react";
import { Link } from "react-router-dom";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const exampleJson = `[
  {
    "term": "resilient",
    "definition": "Able to recover quickly from difficulty.",
    "translation": "有韌性的",
    "example": "She is resilient after every setback.",
    "partOfSpeech": "adjective",
    "tags": ["personality", "advanced"]
  }
]`;

function validateImportData(value) {
  if (!Array.isArray(value)) {
    return "JSON must be an array of word objects.";
  }

  if (value.length === 0) {
    return "JSON array must contain at least one word.";
  }

  const invalidIndex = value.findIndex(
    (word) =>
      !word ||
      typeof word !== "object" ||
      !String(word.term ?? "").trim() ||
      !String(word.definition ?? "").trim(),
  );

  if (invalidIndex !== -1) {
    return `Word #${invalidIndex + 1} needs both term and definition.`;
  }

  return "";
}

function ImportPage() {
  const { importWords } = useWordsContext();
  const [jsonInput, setJsonInput] = useState(exampleJson);
  const [previewWords, setPreviewWords] = useState([]);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  function handlePreview() {
    setError("");
    setSummary(null);

    try {
      const parsedValue = JSON.parse(jsonInput);
      const validationError = validateImportData(parsedValue);

      if (validationError) {
        setPreviewWords([]);
        setError(validationError);
        return;
      }

      setPreviewWords(parsedValue);
    } catch (parseError) {
      setPreviewWords([]);
      setError(`Invalid JSON: ${parseError.message}`);
    }
  }

  async function handleImport() {
    try {
      setError("");
      setIsImporting(true);

      const result = await importWords(previewWords);

      setSummary({
        importedCount: result.importedWords.length,
        skippedCount: result.skippedWords.length,
      });
      setPreviewWords([]);
    } catch (importError) {
      setError(importError.message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="w-full max-w-5xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <div className="mb-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          Bulk Add
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          Import JSON
        </h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Paste an array of words. Each word must include <code>term</code> and{" "}
          <code>definition</code>. Optional fields include translation,
          pronunciation, partOfSpeech, example, notes, and tags.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              JSON words
            </span>
            <textarea
              className="mt-2 min-h-96 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              onChange={(event) => setJsonInput(event.target.value)}
              value={jsonInput}
            />
          </label>

          {error ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          {summary ? (
            <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              Imported {summary.importedCount}{" "}
              {summary.importedCount === 1 ? "word" : "words"} and skipped{" "}
              {summary.skippedCount} duplicate{" "}
              {summary.skippedCount === 1 ? "word" : "words"}.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-blue-100 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
              onClick={handlePreview}
              type="button"
            >
              Preview Import
            </button>
            <button
              className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={previewWords.length === 0 || isImporting}
              onClick={handleImport}
              type="button"
            >
              {isImporting ? "Importing..." : "Import Words"}
            </button>
            <Link
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              to="/words"
            >
              Word List
            </Link>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-xl font-bold text-blue-950">Preview</h2>
          {previewWords.length === 0 ? (
            <p className="mt-3 text-slate-600">
              Click Preview Import to validate your JSON before saving.
            </p>
          ) : (
            <ul className="mt-4 max-h-96 space-y-3 overflow-auto pr-2">
              {previewWords.map((word, index) => (
                <li
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                  key={`${word.term}-${index}`}
                >
                  <h3 className="font-bold text-blue-950">{word.term}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {word.definition}
                  </p>
                  {Array.isArray(word.tags) && word.tags.length > 0 ? (
                    <p className="mt-2 text-xs font-semibold text-blue-700">
                      {word.tags.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}

export default ImportPage;
