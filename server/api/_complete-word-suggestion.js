import {
  getVocabularyLocaleLabel,
  hasPlaceholderTranslation,
  hasValidChineseTranslationFields,
  isExamPhraseTerm,
  isIncompleteExamPhraseTranslation,
  looksLikeEnglishText,
  pickChineseText,
  resolveVocabularyLocale,
} from "../../lib/vocabularyLocale.js";
import { isAiJsonOutputError, parseAgnesJson } from "./_parse-agnes-json.js";

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

function buildTranslationRepairPrompt(term, chineseLabel, suggestion) {
  const definition = String(suggestion?.definition ?? "").trim();
  const example = String(suggestion?.example ?? "").trim();
  const examplePart = example
    ? `\nExample sentence: ${example}\nexampleTranslation must translate that sentence into ${chineseLabel}.`
    : "";

  return `Fix the Chinese translation fields on a vocabulary card for Hong Kong English learners.

English word: ${term}
${definition ? `Definition: ${definition}` : ""}${examplePart}

Return JSON only:
{"translation": "...", "exampleTranslation": "..."}

Rules:
- translation and exampleTranslation MUST use ${chineseLabel} characters only.
- Never output English words, Latin letters, or romanization in translation or exampleTranslation.
- translation must be the natural ${chineseLabel} term a learner would see in a dictionary entry, not the English word spelled again.
- If the word is a loanword, use the established ${chineseLabel} equivalent (for example pizza -> 披薩).
- Do not use asterisks, placeholders, or synonym lists.`;
}

async function requestAgnesJson(apiKey, messages) {
  const aiResponse = await fetch(AGNES_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AGNES_MODEL || "agnes-2.0-flash",
      messages,
      temperature: 0.2,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    throw new Error(`AI request failed: ${errorText}`);
  }

  const data = await aiResponse.json();
  return parseAgnesJson(data);
}

async function requestTranslationRepair(term, chineseLabel, apiKey, suggestion) {
  let lastError = null;

  for (let attempt = 0; attempt < AI_OUTPUT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const repair = await requestAgnesJson(apiKey, [
        {
          role: "system",
          content:
            "You repair vocabulary cards for English learners. Return only valid JSON with Chinese translation fields.",
        },
        {
          role: "user",
          content: buildTranslationRepairPrompt(term, chineseLabel, suggestion),
        },
      ]);

      return {
        ...suggestion,
        translation: pickChineseText(repair?.translation, suggestion.translation, term),
        exampleTranslation: pickChineseText(
          repair?.exampleTranslation,
          suggestion.exampleTranslation,
          term
        ),
      };
    } catch (error) {
      lastError = error;
      if (attempt < AI_OUTPUT_RETRY_ATTEMPTS - 1 && isAiJsonOutputError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error(`Translation repair failed for ${term}.`);
}

function levenshteinDistance(left, right) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function looksLikeSpellingCorrection(term, translation) {
  const cleanTerm = String(term ?? "").trim().toLowerCase();
  const candidate = String(translation ?? "").trim().toLowerCase();

  if (!cleanTerm || !candidate || cleanTerm === candidate) {
    return false;
  }

  if (!looksLikeEnglishText(translation) || candidate.includes(" ")) {
    return false;
  }

  if (Math.abs(cleanTerm.length - candidate.length) > 2) {
    return false;
  }

  return levenshteinDistance(cleanTerm, candidate) <= 2;
}

async function requestSpellingCorrectedSuggestion(term, chineseLabel, apiKey, suggestion) {
  const correctedTerm = String(suggestion?.translation ?? "").trim();
  if (!looksLikeSpellingCorrection(term, correctedTerm)) {
    return suggestion;
  }

  const correctedSuggestion = await requestSuggestion(correctedTerm, chineseLabel, apiKey, {
    strict: true,
  });

  if (!hasValidChineseTranslationFields(correctedSuggestion, term)) {
    return suggestion;
  }

  return {
    ...correctedSuggestion,
    term,
    example: suggestion.example || correctedSuggestion.example,
  };
}

function ensureAgnesApiKey() {
  const apiKey = String(process.env.AGNES_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("AGNES_API_KEY is not configured on the server.");
  }

  return apiKey;
}

export async function generateCompleteWordSuggestion(
  term,
  locale = "zh-Hant",
  { quickFill = false } = {},
) {
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

  if (quickFill) {
    if (!hasValidChineseTranslationFields(suggestion, cleanTerm)) {
      suggestion = await requestSuggestion(cleanTerm, chineseLabel, apiKey, {
        strict: true,
        phrase: isExamPhraseTerm(cleanTerm),
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
  if (!hasValidChineseTranslationFields(suggestion, cleanTerm)) {
    suggestion = await requestSuggestion(cleanTerm, chineseLabel, apiKey, { strict: true });
  }

  if (
    !hasValidChineseTranslationFields(suggestion, cleanTerm) &&
    (cleanTerm.includes(" ") ||
      hasPlaceholderTranslation(suggestion.translation) ||
      hasPlaceholderTranslation(suggestion.exampleTranslation) ||
      looksLikeEnglishText(suggestion.translation) ||
      looksLikeEnglishText(suggestion.exampleTranslation) ||
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
    suggestion = await requestSpellingCorrectedSuggestion(
      cleanTerm,
      chineseLabel,
      apiKey,
      suggestion
    );
  }

  if (!hasValidChineseTranslationFields(suggestion, cleanTerm)) {
    suggestion = await requestTranslationRepair(
      cleanTerm,
      chineseLabel,
      apiKey,
      suggestion
    );
  }

  if (!hasValidChineseTranslationFields(suggestion, cleanTerm)) {
    throw new Error("AI response did not include Chinese translation fields.");
  }

  return {
    ...suggestion,
    term: cleanTerm,
  };
}
