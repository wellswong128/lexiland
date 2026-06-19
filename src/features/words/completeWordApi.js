import { resolveVocabularyLocale } from "../../../lib/vocabularyLocale.js";
import {
  canUseWordbase,
  contributeWordDetailsFromSuggestion,
  fetchWordbaseEntry,
  hasWordbaseDetails,
  wordbaseEntryToSuggestion,
} from "./wordbaseApi.js";

export function createDemoSuggestion(term) {
  const normalizedTerm = term.trim();

  return {
    term: normalizedTerm,
    definition: `A demo vocabulary card for "${normalizedTerm}". Replace this with the real definition before saving.`,
    translation: "示範翻譯",
    pronunciation: "",
    partOfSpeech: "word",
    example: `I am learning how to use "${normalizedTerm}" in a sentence.`,
    exampleTranslation: "我正在學習如何在句子中使用這個字。",
    tags: ["demo", "ai-fallback"],
  };
}

export async function readJsonResponse(response) {
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

export function suggestionToFormValues(suggestion) {
  return {
    term: suggestion.term ?? "",
    definition: suggestion.definition ?? "",
    translation: suggestion.translation ?? "",
    pronunciation: suggestion.pronunciation ?? "",
    partOfSpeech: suggestion.partOfSpeech ?? "",
    example: suggestion.example ?? "",
    exampleTranslation: suggestion.exampleTranslation ?? "",
    tags: Array.isArray(suggestion.tags) ? suggestion.tags.join(", ") : "",
  };
}

export async function fetchCompleteWord(term, uiLocale = "zh-Hant") {
  const vocabularyLocale = resolveVocabularyLocale(uiLocale);
  const response = await fetch("/api/complete-word", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ term, locale: vocabularyLocale, vocabularyLocale }),
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "AI Fill failed.");
  }

  return {
    suggestion: data.suggestion,
    usedFallback: false,
  };
}

export async function fetchCompleteWordWithFallback(
  term,
  locale = "zh-Hant",
  { user, skipWordbase = false } = {},
) {
  if (!skipWordbase) {
    try {
      if (canUseWordbase(user)) {
        const entry = await fetchWordbaseEntry(term);

        if (hasWordbaseDetails(entry)) {
          return {
            suggestion: wordbaseEntryToSuggestion(entry),
            usedFallback: false,
            fromWordbase: true,
          };
        }
      }
    } catch (wordbaseError) {
      console.warn("Could not read word from wordbase.", wordbaseError);
    }
  }

  try {
    const result = await fetchCompleteWord(term, locale);

    if (!skipWordbase && user?.id && !result.usedFallback) {
      void contributeWordDetailsFromSuggestion(result.suggestion, user.id).catch((syncError) => {
        console.warn("Could not contribute word details to wordbase.", syncError);
      });
    }

    return {
      ...result,
      fromWordbase: false,
    };
  } catch (error) {
    return {
      suggestion: createDemoSuggestion(term),
      usedFallback: true,
      fallbackReason: error.message,
      fromWordbase: false,
    };
  }
}

export async function completeWordsInBatch(
  terms,
  { locale = "zh-Hant", onProgress, user } = {},
) {
  const results = [];

  for (let index = 0; index < terms.length; index += 1) {
    const term = terms[index];
    const result = await fetchCompleteWordWithFallback(term, locale, { user });

    results.push({
      ...suggestionToFormValues(result.suggestion),
      usedFallback: result.usedFallback,
      fromWordbase: Boolean(result.fromWordbase),
    });

    onProgress?.(index + 1, terms.length);
  }

  return results;
}

export async function fetchExtractedWords(imageDataUrl) {
  const response = await fetch("/api/extract-words-from-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageDataUrl }),
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Could not extract words from the image.");
  }

  return data.words ?? [];
}
