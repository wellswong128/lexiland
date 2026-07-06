import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  completeWordsInBatch,
  fetchCompleteWordWithFallback,
  fetchExtractedWords,
  suggestionToFormValues,
} from "../features/words/completeWordApi.js";
import { WORD_SOURCES, normalizeTerm } from "../features/words/wordTypes.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { compressImageFile } from "../lib/compressImage.js";
import { goBackToPreviousPage } from "../lib/navigation.js";
import {
  clearPhotoCaptureDraft,
  loadPhotoCaptureDraft,
  savePhotoCaptureDraft,
} from "../lib/storage.js";
import { splitIntoSingleWordTerms } from "../../lib/normalizeWordTerms.js";

function getInitialPhotoCaptureState() {
  const draft = loadPhotoCaptureDraft();

  if (!draft) {
    return {
      detectedWords: [],
      hasRestoredDraft: false,
      imageDataUrl: "",
      previewUrl: "",
      previewWords: [],
      selectedTerms: [],
      step: "upload",
    };
  }

  const step = draft.step === "select" || draft.step === "preview" ? draft.step : "upload";

  return {
    detectedWords: Array.isArray(draft.detectedWords) ? draft.detectedWords : [],
    hasRestoredDraft: step === "preview" && Array.isArray(draft.previewWords) && draft.previewWords.length > 0,
    imageDataUrl: draft.imageDataUrl ?? draft.previewUrl ?? "",
    previewUrl: draft.previewUrl ?? draft.imageDataUrl ?? "",
    previewWords: Array.isArray(draft.previewWords) ? draft.previewWords : [],
    selectedTerms: Array.isArray(draft.selectedTerms) ? draft.selectedTerms : [],
    step,
  };
}

function removeSavedTermsFromPreview(previewWords, savedWords) {
  const savedTerms = new Set(savedWords.map((word) => normalizeTerm(word.term)));

  return previewWords.filter((word) => !savedTerms.has(normalizeTerm(word.term)));
}

function toPreviewText(value) {
  if (value == null) {
    return "";
  }

  return typeof value === "string" ? value : String(value);
}

function buildPreviewWord(word, term, index) {
  const values = suggestionToFormValues(word);

  return {
    ...values,
    definition: toPreviewText(values.definition),
    translation: toPreviewText(values.translation),
    term: toPreviewText(values.term || term),
    id: `${term}-${index}`,
    enabled: true,
    usedFallback: Boolean(word.usedFallback),
    fromLocal: Boolean(word.fromLocal),
    fromWordbase: Boolean(word.fromWordbase),
  };
}

function PhotoWordCapture({ autoOpenCamera = false, onAutoOpenCameraConsumed }) {
  const initialState = useMemo(() => getInitialPhotoCaptureState(), []);
  const { locale, t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const { importWords, words, user } = useWordsContext();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const hasShownRestoreMessageRef = useRef(false);

  const [step, setStep] = useState(initialState.step);
  const [previewUrl, setPreviewUrl] = useState(initialState.previewUrl);
  const [imageDataUrl, setImageDataUrl] = useState(initialState.imageDataUrl);
  const [detectedWords, setDetectedWords] = useState(initialState.detectedWords);
  const [selectedTerms, setSelectedTerms] = useState(initialState.selectedTerms);
  const [manualTerm, setManualTerm] = useState("");
  const [previewWords, setPreviewWords] = useState(initialState.previewWords);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [retryingWordId, setRetryingWordId] = useState(null);
  const [isRetryingAllFailed, setIsRetryingAllFailed] = useState(false);
  const [completionProgress, setCompletionProgress] = useState({ current: 0, total: 0 });

  const existingTerms = useMemo(
    () => new Set(words.map((word) => word.term.trim().toLowerCase())),
    [words],
  );

  const selectableTerms = useMemo(
    // Web users: hide only words already in their personal list, not Wordbase entries.
    () => detectedWords.filter((term) => !existingTerms.has(term)),
    [detectedWords, existingTerms],
  );

  const allSelectableSelected =
    selectableTerms.length > 0 &&
    selectableTerms.every((term) => selectedTerms.includes(term));

  const fallbackPreviewWords = useMemo(
    () => previewWords.filter((word) => word.usedFallback),
    [previewWords],
  );

  const enabledDemoPreviewWords = useMemo(
    () => previewWords.filter((word) => word.enabled && word.usedFallback),
    [previewWords],
  );

  const canSavePreviewWords = enabledDemoPreviewWords.length === 0;

  useEffect(() => {
    if (!initialState.hasRestoredDraft || hasShownRestoreMessageRef.current) {
      return;
    }

    hasShownRestoreMessageRef.current = true;
    setStatusMessage(t("addWord.photo.draftRestored"));
  }, [initialState.hasRestoredDraft, t]);

  useEffect(() => {
    if (!autoOpenCamera || step !== "upload" || isExtracting) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      cameraInputRef.current?.click();
      onAutoOpenCameraConsumed?.();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [autoOpenCamera, isExtracting, onAutoOpenCameraConsumed, step]);

  useEffect(() => {
    if (step === "upload") {
      clearPhotoCaptureDraft();
      return;
    }

    const hasDraft =
      (step === "select" && detectedWords.length > 0) ||
      (step === "preview" && previewWords.length > 0);

    if (!hasDraft) {
      clearPhotoCaptureDraft();
      return;
    }

    savePhotoCaptureDraft({
      detectedWords,
      imageDataUrl,
      previewUrl: imageDataUrl || previewUrl,
      previewWords,
      selectedTerms,
      step,
      updatedAt: new Date().toISOString(),
    });
  }, [step, previewUrl, imageDataUrl, detectedWords, selectedTerms, previewWords]);

  async function handleImageFile(file) {
    try {
      setError("");
      setStatusMessage("");
      setIsExtracting(true);

      const compressed = await compressImageFile(file);

      setPreviewUrl(compressed.previewUrl);
      setImageDataUrl(compressed.dataUrl);

      const extractedWords = await fetchExtractedWords(compressed.dataUrl);
      const terms = splitIntoSingleWordTerms(extractedWords.map((item) => item.term));

      setDetectedWords(terms);
      setSelectedTerms([]);
      setStep("select");
      setStatusMessage(t("addWord.photo.detectedCount", { count: terms.length }));
    } catch (imageError) {
      setError(imageError.message);
    } finally {
      setIsExtracting(false);
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      handleImageFile(file);
    }

    event.target.value = "";
  }

  function toggleTerm(term) {
    setSelectedTerms((currentTerms) =>
      currentTerms.includes(term)
        ? currentTerms.filter((value) => value !== term)
        : [...currentTerms, term],
    );
  }

  function toggleSelectAll() {
    setSelectedTerms(allSelectableSelected ? [] : selectableTerms);
  }

  function handleAddManualTerm() {
    const terms = splitIntoSingleWordTerms(manualTerm);

    if (terms.length === 0) {
      return;
    }

    setDetectedWords((currentWords) => {
      const nextWords = [...currentWords];

      terms.forEach((term) => {
        if (!nextWords.includes(term)) {
          nextWords.push(term);
        }
      });

      return nextWords;
    });
    setSelectedTerms((currentTerms) => {
      const nextTerms = [...currentTerms];

      terms.forEach((term) => {
        if (!nextTerms.includes(term)) {
          nextTerms.push(term);
        }
      });

      return nextTerms;
    });
    setManualTerm("");
  }

  async function handleCompleteSelected() {
    if (selectedTerms.length === 0) {
      setError(t("addWord.photo.selectAtLeastOne"));
      return;
    }

    try {
      setError("");
      setStatusMessage("");
      setIsCompleting(true);
      setCompletionProgress({ current: 0, total: selectedTerms.length });

      const completedWords = await completeWordsInBatch(selectedTerms, {
        locale,
        user,
        onProgress: (current, total) => {
          setCompletionProgress({ current, total });
        },
      });

      setPreviewWords(
        completedWords.map((word, index) => buildPreviewWord(word, selectedTerms[index], index)),
      );
      setStep("preview");
      setStatusMessage(t("addWord.photo.previewReady"));
    } catch (completeError) {
      setError(completeError.message);
    } finally {
      setIsCompleting(false);
    }
  }

  function updatePreviewWord(wordId, field, value) {
    setPreviewWords((currentWords) =>
      currentWords.map((word) =>
        word.id === wordId
          ? {
              ...word,
              [field]: value,
            }
          : word,
      ),
    );
  }

  function togglePreviewWord(wordId) {
    setPreviewWords((currentWords) =>
      currentWords.map((word) =>
        word.id === wordId
          ? {
              ...word,
              enabled: !word.enabled,
            }
          : word,
      ),
    );
  }

  async function handleRetryAiForWord(wordId) {
    const word = previewWords.find((item) => item.id === wordId);

    if (!word) {
      return;
    }

    try {
      setRetryingWordId(wordId);
      setError("");

      const result = await fetchCompleteWordWithFallback(word.term, locale, {
        user,
        skipWordbase: true,
      });

      setPreviewWords((currentWords) =>
        currentWords.map((item) =>
          item.id === wordId
            ? {
                ...item,
                ...suggestionToFormValues(result.suggestion),
                usedFallback: false,
              }
            : item,
        ),
      );
      setStatusMessage(t("addWord.photo.retrySuccess", { term: word.term }));
    } catch (retryError) {
      setError(
        t("addWord.photo.retryFailed", {
          reason: retryError.message,
          term: word.term,
        }),
      );
    } finally {
      setRetryingWordId(null);
    }
  }

  async function handleRetryAllFailed() {
    const failedWords = previewWords.filter((word) => word.usedFallback);

    if (failedWords.length === 0) {
      return;
    }

    try {
      setIsRetryingAllFailed(true);
      setError("");

      let successCount = 0;

      for (const word of failedWords) {
        setRetryingWordId(word.id);

        try {
          const result = await fetchCompleteWordWithFallback(word.term, locale, {
        user,
        skipWordbase: true,
      });

          setPreviewWords((currentWords) =>
            currentWords.map((item) =>
              item.id === word.id
                ? {
                    ...item,
                    ...suggestionToFormValues(result.suggestion),
                    usedFallback: false,
                  }
                : item,
            ),
          );
          successCount += 1;
        } catch {
          // Keep demo fallback for this word and continue with the rest.
        }
      }

      if (successCount === failedWords.length) {
        setStatusMessage(t("addWord.photo.retryAllSuccess", { count: successCount }));
      } else if (successCount > 0) {
        setStatusMessage(
          t("addWord.photo.retryAllPartial", {
            failed: failedWords.length - successCount,
            success: successCount,
          }),
        );
      } else {
        setError(t("addWord.photo.retryAllFailedMessage"));
      }
    } finally {
      setRetryingWordId(null);
      setIsRetryingAllFailed(false);
    }
  }

  async function handleSaveAll() {
    if (!canSavePreviewWords) {
      setError(
        t("addWord.photo.saveBlockedDemo", {
          count: enabledDemoPreviewWords.length,
        }),
      );
      return;
    }

    const wordsToSave = previewWords
      .filter((word) => word.enabled && !word.usedFallback)
      .map((word) => ({
        term: word.term,
        definition: word.definition,
        translation: word.translation,
        pronunciation: word.pronunciation,
        partOfSpeech: word.partOfSpeech,
        example: word.example,
        exampleTranslation: word.exampleTranslation,
        tags: word.tags,
      }))
      .filter((word) => word.term.trim() && word.definition.trim());

    if (wordsToSave.length === 0) {
      setError(t("addWord.photo.noValidWords"));
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setStatusMessage("");

      const result = await importWords(wordsToSave, {
        source: WORD_SOURCES.PHOTO,
        photoBatchId: `photo-${Date.now()}`,
      });

      const importedCount = result.importedWords.length;
      const skippedCount = result.skippedWords.length;
      const remainingPreviewWords = removeSavedTermsFromPreview(
        previewWords,
        result.importedWords,
      );

      if (importedCount === 0) {
        if (remainingPreviewWords.length !== previewWords.length) {
          setPreviewWords(remainingPreviewWords);
        }
        setError(t("addWord.photo.allSkipped"));
        return;
      }

      if (remainingPreviewWords.length > 0) {
        setPreviewWords(remainingPreviewWords);
        setStatusMessage(
          t("addWord.photo.partialSaveSuccess", {
            imported: importedCount,
            remaining: remainingPreviewWords.length,
            skipped: skippedCount,
          }),
        );
        return;
      }

      clearPhotoCaptureDraft();
      setStatusMessage(
        t("addWord.photo.saveSuccess", {
          imported: importedCount,
          skipped: skippedCount,
        }),
      );
      goBackToPreviousPage(navigate, location);
    } catch (saveError) {
      const savedWords = saveError.savedWords ?? [];
      const remainingPreviewWords =
        savedWords.length > 0
          ? removeSavedTermsFromPreview(previewWords, savedWords)
          : previewWords;

      if (savedWords.length > 0) {
        setPreviewWords(remainingPreviewWords);
        setStatusMessage(
          t("addWord.photo.partialSaveRetry", {
            imported: savedWords.length,
            remaining: remainingPreviewWords.length,
          }),
        );
      }

      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function resetFlow() {
    clearPhotoCaptureDraft();
    setStep("upload");
    setPreviewUrl("");
    setImageDataUrl("");
    setDetectedWords([]);
    setSelectedTerms([]);
    setPreviewWords([]);
    setManualTerm("");
    setError("");
    setStatusMessage("");
    setCompletionProgress({ current: 0, total: 0 });
  }

  return (
    <div className="space-y-5">
      {step === "upload" ? (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-5 text-center">
          <p className="text-sm font-semibold text-blue-950">{t("addWord.photo.uploadTitle")}</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            {t("addWord.photo.uploadDescription")}
          </p>

          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
              disabled={isExtracting}
              onClick={() => cameraInputRef.current?.click()}
              type="button"
            >
              {t("addWord.photo.takePhoto")}
            </button>
            <button
              className="rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:bg-slate-100"
              disabled={isExtracting}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {t("addWord.photo.choosePhoto")}
            </button>
          </div>

          <input
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            ref={cameraInputRef}
            type="file"
          />
          <input
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />

          {isExtracting ? (
            <p className="mt-4 text-sm font-medium text-blue-700">
              {t("addWord.photo.extracting")}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === "select" && previewUrl ? (
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
          <img
            alt={t("addWord.photo.previewAlt")}
            className="max-h-64 w-full object-contain bg-slate-100"
            src={previewUrl}
          />
        </div>
      ) : null}

      {step === "select" ? (
        <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-blue-950">{t("addWord.photo.selectTitle")}</h3>
              <p className="mt-1 text-sm text-slate-600">{t("addWord.photo.selectDescription")}</p>
            </div>
            <button
              className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700"
              onClick={resetFlow}
              type="button"
            >
              {t("addWord.photo.retake")}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:bg-slate-100 disabled:text-slate-400"
              disabled={selectableTerms.length === 0}
              onClick={toggleSelectAll}
              type="button"
            >
              {allSelectableSelected
                ? t("addWord.photo.unselectAll")
                : t("addWord.photo.selectAll")}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {detectedWords.map((term) => {
              const isSelected = selectedTerms.includes(term);
              const alreadySaved = existingTerms.has(term);

              return (
                <button
                  className={[
                    "rounded-full border px-3 py-2 text-sm font-bold transition",
                    alreadySaved
                      ? "border-slate-200 bg-slate-100 text-slate-400"
                      : isSelected
                        ? "border-blue-700 bg-blue-700 text-white"
                        : "border-blue-200 bg-white text-blue-800 hover:bg-blue-100",
                  ].join(" ")}
                  disabled={alreadySaved}
                  key={term}
                  onClick={() => toggleTerm(term)}
                  type="button"
                >
                  {term}
                  {alreadySaved ? ` (${t("addWord.photo.alreadySaved")})` : ""}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              onChange={(event) => setManualTerm(event.target.value)}
              placeholder={t("addWord.photo.manualPlaceholder")}
              value={manualTerm}
            />
            <button
              className="rounded-full border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700"
              onClick={handleAddManualTerm}
              type="button"
            >
              {t("addWord.photo.addManual")}
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">
              {t("addWord.photo.selectedCount", { count: selectedTerms.length })}
            </p>
            <button
              className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
              disabled={isCompleting || selectedTerms.length === 0}
              onClick={handleCompleteSelected}
              type="button"
            >
              {isCompleting
                ? t("addWord.photo.completing", {
                    current: completionProgress.current,
                    total: completionProgress.total,
                  })
                : t("addWord.photo.completeSelected")}
            </button>
          </div>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-blue-950">{t("addWord.photo.previewTitle")}</h3>
              <p className="mt-1 text-sm text-slate-600">{t("addWord.photo.previewDescription")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {fallbackPreviewWords.length > 0 ? (
                <button
                  className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                  disabled={isRetryingAllFailed || Boolean(retryingWordId) || isSaving}
                  onClick={handleRetryAllFailed}
                  type="button"
                >
                  {isRetryingAllFailed
                    ? t("addWord.photo.retryingAllFailed")
                    : t("addWord.photo.retryAllFailed", {
                        count: fallbackPreviewWords.length,
                      })}
                </button>
              ) : null}
              <button
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700"
                onClick={() => setStep("select")}
                type="button"
              >
                {t("addWord.photo.backToSelect")}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {previewWords.map((word) => (
              <div
                className={[
                  "rounded-2xl border p-4",
                  word.enabled ? "border-blue-100 bg-white" : "border-slate-200 bg-slate-50 opacity-70",
                ].join(" ")}
                key={word.id}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      checked={word.enabled}
                      onChange={() => togglePreviewWord(word.id)}
                      type="checkbox"
                    />
                    <span>{word.term}</span>
                  </label>
                  {word.usedFallback ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                        {t("addWord.photo.demoFallback")}
                      </span>
                      <button
                        className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-900 transition hover:bg-amber-50 disabled:opacity-60"
                        disabled={
                          isRetryingAllFailed ||
                          retryingWordId === word.id ||
                          isSaving
                        }
                        onClick={() => handleRetryAiForWord(word.id)}
                        type="button"
                      >
                        {retryingWordId === word.id
                          ? t("addWord.photo.retryingAi")
                          : t("addWord.photo.retryAi")}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-700">{t("addWord.definition")}</span>
                    <textarea
                      className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2"
                      onChange={(event) =>
                        updatePreviewWord(word.id, "definition", event.target.value)
                      }
                      value={word.definition ?? ""}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-semibold text-slate-700">{t("addWord.translation")}</span>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                      onChange={(event) =>
                        updatePreviewWord(word.id, "translation", event.target.value)
                      }
                      value={word.translation ?? ""}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-end gap-2">
            {!canSavePreviewWords ? (
              <p className="max-w-md text-right text-sm font-medium text-amber-800">
                {t("addWord.photo.saveBlockedDemoHint", {
                  count: enabledDemoPreviewWords.length,
                })}
              </p>
            ) : null}
            <button
              className="rounded-full bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-800 disabled:bg-slate-300"
              disabled={isSaving || !canSavePreviewWords}
              onClick={handleSaveAll}
              type="button"
            >
              {isSaving ? t("common.saving") : t("addWord.photo.saveAll")}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {statusMessage}
        </p>
      ) : null}

    </div>
  );
}

export default PhotoWordCapture;
