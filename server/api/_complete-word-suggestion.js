import {
  getVocabularyLocaleLabel,
  hasPlaceholderTranslation,
  hasValidChineseTranslationFields,
  isExamPhraseTerm,
  isIncompleteExamPhraseTranslation,
  resolveVocabularyLocale,
} from "../../lib/vocabularyLocale.js";
import { isAiJsonOutputError, parseAgnesJson } from "../_parse-agnes-json.js";

const AGNES_API_URL = "https://apihub.agnes-ai.com/v1/chat/completions";
const AI_OUTPUT_RETRY_ATTEMPTS = 3;

function normalizeSuggestion(value) {
  return {
    term: String(value?.term ?? "").trim(),
    definition: String(value?.definition ?? "").trim(),
    translation: String(value?.translation ?? "").trim(),
    pronunciation: String(value?.pronunciation ?? "").trim(),
    partOfSpeech: String(value?.partOfSpeech ?? "").trim(),
    example: String(value?.example ?? "").trim(),
    exampleTranslation: String(value?.exampleTranslation ?? "").trim(),
    tags: Array.isArray(value?.tags)
      ? value.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
  };
}

function buildPrompt(term, chineseLabel, { strict = false, phrase = false } = {}) {
  const phraseMode = phrase || isExamPhraseTerm(term);
  const strictRule = strict
    ? `\nIMPORTANT: translation and exampleTranslation MUST be written in ${chineseLabel} using Chinese characters. Do NOT use English for those two fields.`
    : "";

  const phraseRule = phraseMode
    ? `\nIMPORTANT: This is a multi-word examination skill phrase. translation must translate the ENTIRE phrase into natural ${chineseLabel}. Do NOT translate only the first word, do NOT give synonym lists like "評估；評價", and do NOT use asterisks or placeholders. Example: "evaluate French Revolution" -> "評估法國大革命".`
    : "";

  const multiWordRule =
    term.includes(" ") && !phraseMode
      ? `\nIf the term has multiple words, translation must cover the full phrase in ${chineseLabel}. Never use * or ... as placeholders.`
      : "";

  return `Create vocabulary data for this English word: ${term}

Return only valid JSON with these fields:
term, definition, translation, pronunciation, partOfSpeech, example, exampleTranslation, tags.

Use ${chineseLabel} for translation and exampleTranslation.
translation must be the ${chineseLabel} meaning of the word (not English).
example must be a natural English sentence that uses the word.
exampleTranslation must be the ${chineseLabel} translation of example.
Keep the definition concise and learner-friendly. Tags should be an array of short English labels.
Use plain double quotes in JSON strings. Escape any internal quotes with backslashes. Do not use smart quotes or unescaped quotation marks inside values.${multiWordRule}${strictRule}${phraseRule}`;
}

async function requestSuggestion(term, chineseLabel, apiKey, { strict = false, phrase = false } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < AI_OUTPUT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const aiResponse = await fetch(AGNES_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AGNES_MODEL || "agnes-2.0-flash",
          messages: [
            {
              role: "system",
              content:
                "You help English learners create vocabulary cards. Return only valid JSON.",
            },
            {
              role: "user",
              content: buildPrompt(term, chineseLabel, { strict, phrase }),
            },
          ],
          temperature: 0.2,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI request failed: ${errorText}`);
      }

      const data = await aiResponse.json();
      return normalizeSuggestion(parseAgnesJson(data));
    } catch (error) {
      lastError = error;
      if (attempt < AI_OUTPUT_RETRY_ATTEMPTS - 1 && isAiJsonOutputError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error(`Complete-word failed for ${term}.`);
}

function ensureAgnesApiKey() {
  const apiKey = String(process.env.AGNES_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("AGNES_API_KEY is not configured on the server.");
  }

  return apiKey;
}

export async function generateCompleteWordSuggestion(term, locale = "zh-Hant") {
  const cleanTerm = String(term ?? "").trim();
  if (!cleanTerm) {
    throw new Error("Please provide an English word.");
  }

  const apiKey = ensureAgnesApiKey();
  const vocabularyLocale = resolveVocabularyLocale(String(locale ?? "zh-Hant").trim());
  const chineseLabel = getVocabularyLocaleLabel(vocabularyLocale);

  let suggestion = await requestSuggestion(cleanTerm, chineseLabel, apiKey, {
    phrase: isExamPhraseTerm(cleanTerm),
  });
  if (!hasValidChineseTranslationFields(suggestion, cleanTerm)) {
    suggestion = await requestSuggestion(cleanTerm, chineseLabel, apiKey, { strict: true });
  }

  if (
    !hasValidChineseTranslationFields(suggestion, cleanTerm) &&
    (cleanTerm.includes(" ") ||
      hasPlaceholderTranslation(suggestion.translation) ||
      hasPlaceholderTranslation(suggestion.exampleTranslation) ||
      isIncompleteExamPhraseTranslation(cleanTerm, suggestion.translation))
  ) {
    suggestion = await requestSuggestion(cleanTerm, chineseLabel, apiKey, {
      strict: true,
      phrase: true,
    });
  }

  if (!suggestion.term || !suggestion.definition) {
    throw new Error("AI response was missing term or definition.");
  }

  if (!hasValidChineseTranslationFields(suggestion, cleanTerm)) {
    throw new Error("AI response did not include Chinese translation fields.");
  }

  return {
    ...suggestion,
    term: cleanTerm,
  };
}
