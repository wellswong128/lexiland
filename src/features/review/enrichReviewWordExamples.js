import { containsChinese } from "../../../lib/vocabularyLocale.js";
import { fetchCompleteWordWithFallback } from "../words/completeWordApi.js";
import { canUseWordbase, fetchWordbaseEntry } from "../words/wordbaseApi.js";

export function needsExampleEnrichment(word) {
  const example = String(word.example ?? "").trim();
  const exampleTranslation = String(word.exampleTranslation ?? "").trim();

  if (!example) {
    return true;
  }

  return !exampleTranslation || !containsChinese(exampleTranslation);
}

export function buildExampleEnrichmentChanges(word, source) {
  const changes = {};
  const example = String(source.example ?? "").trim();
  const exampleTranslation = String(source.exampleTranslation ?? "").trim();
  const currentExample = String(word.example ?? "").trim();
  const currentExampleTranslation = String(word.exampleTranslation ?? "").trim();

  if (!currentExample && example) {
    changes.example = example;
  }

  if (
    (!currentExampleTranslation || !containsChinese(currentExampleTranslation)) &&
    exampleTranslation &&
    containsChinese(exampleTranslation)
  ) {
    changes.exampleTranslation = exampleTranslation;
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

async function readWordbaseExampleDetails(term) {
  const entry = await fetchWordbaseEntry(term);

  if (!entry) {
    return null;
  }

  return {
    example: entry.example,
    exampleTranslation: entry.exampleTranslation,
  };
}

async function readAiExampleDetails(term, locale, user) {
  const result = await fetchCompleteWordWithFallback(term, locale, {
    skipWordbase: true,
    user,
  });

  return result.suggestion;
}

export async function enrichReviewWordExamples(
  words,
  { allowAiFallback = true, locale = "zh-Hant", updateWord, user } = {},
) {
  for (const word of words) {
    if (!needsExampleEnrichment(word)) {
      continue;
    }

    let changes = null;

    if (canUseWordbase(user)) {
      try {
        const wordbaseDetails = await readWordbaseExampleDetails(word.term);
        changes = wordbaseDetails
          ? buildExampleEnrichmentChanges(word, wordbaseDetails)
          : null;
      } catch (error) {
        console.warn("Could not read example details from wordbase.", error);
      }
    }

    if (changes) {
      await updateWord(word.id, changes);
      continue;
    }

    if (!allowAiFallback) {
      continue;
    }

    try {
      const suggestion = await readAiExampleDetails(word.term, locale, user);
      changes = buildExampleEnrichmentChanges(word, suggestion);

      if (changes) {
        await updateWord(word.id, changes);
      }
    } catch (error) {
      console.warn("Could not enrich example details with AI fill.", error);
    }
  }
}
