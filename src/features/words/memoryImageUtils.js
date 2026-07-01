export function normalizeMemoryImage(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const imageUrl = String(value.imageUrl ?? value.url ?? "").trim();

  if (!imageUrl) {
    return null;
  }

  const normalized = { imageUrl };

  const prompt = String(value.prompt ?? "").trim();
  if (prompt) {
    normalized.prompt = prompt;
  }

  const publicId = String(value.publicId ?? "").trim();
  if (publicId) {
    normalized.publicId = publicId;
  }

  return normalized;
}

export function hasMemoryImageUrl(value) {
  return Boolean(normalizeMemoryImage(value)?.imageUrl);
}
