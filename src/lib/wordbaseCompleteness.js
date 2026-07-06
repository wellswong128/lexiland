const MISSING_FIELD_CONFIG = [
  { key: "definition", column: "definition" },
  { key: "translation", column: "translation" },
  { key: "example", column: "example" },
  { key: "exampleTranslation", column: "example_translation" },
];

const CONTENT_TIP_LOCALES = ["zh-Hant", "zh-Hans"];

function hasMemoryTipsValue(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value.savedAt
    ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== "savedAt"))
    : value;

  return (
    Array.isArray(payload.tips) &&
    payload.tips.some(
      (tip) => String(tip?.method ?? "").trim() && String(tip?.content ?? "").trim(),
    )
  );
}

function hasMemoryTipsForLocale(row, locale) {
  const tipsByLocale =
    row?.memory_tips_by_locale && typeof row.memory_tips_by_locale === "object"
      ? row.memory_tips_by_locale
      : {};

  return hasMemoryTipsValue(tipsByLocale[locale]);
}

export function hasContentMemoryTips(row) {
  return CONTENT_TIP_LOCALES.some((tipLocale) => hasMemoryTipsForLocale(row, tipLocale));
}

export function hasMemoryImage(row) {
  const image = row?.memory_image;
  if (!image || typeof image !== "object") {
    return false;
  }

  return Boolean(String(image.imageUrl ?? image.url ?? "").trim());
}

export function missingFieldsForWordbaseRow(row, locale = "zh-Hant") {
  const missing = MISSING_FIELD_CONFIG.filter(({ column }) => !String(row?.[column] ?? "").trim()).map(
    ({ key }) => key,
  );

  if (!hasContentMemoryTips(row)) {
    missing.push("memoryTips");
  }

  if (!hasMemoryImage(row)) {
    missing.push("memoryImage");
  }

  return missing;
}

export function mapWordbaseRow(row, locale = "zh-Hant") {
  return {
    id: row.id,
    termKey: row.term_key,
    term: row.term,
    definition: row.definition ?? "",
    translation: row.translation ?? "",
    pronunciation: row.pronunciation ?? "",
    partOfSpeech: row.part_of_speech ?? "",
    example: row.example ?? "",
    exampleTranslation: row.example_translation ?? "",
    source: row.source ?? "",
    updatedAt: row.updated_at ?? "",
    missingFields: missingFieldsForWordbaseRow(row, locale),
  };
}
