import assert from "node:assert/strict";
import test from "node:test";
import { loadPhotoCaptureDraft, PHOTO_CAPTURE_DRAFT_KEY } from "../src/lib/storage.js";

function createStorage(initialEntries = []) {
  const entries = new Map(initialEntries);
  const calls = {
    removeItem: [],
    setItem: [],
  };

  return {
    calls,
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    removeItem(key) {
      calls.removeItem.push(key);
      entries.delete(key);
    },
    setItem(key, value) {
      calls.setItem.push([key, value]);
      entries.set(key, value);
    },
  };
}

test("loadPhotoCaptureDraft restores oversized valid drafts instead of deleting them", () => {
  const previewWords = Array.from({ length: 260 }, (_, index) => ({
    definition: `definition ${index} ${"x".repeat(500)}`,
    enabled: true,
    id: `word-${index}`,
    term: `word ${index}`,
    translation: `translation ${index}`,
  }));
  const rawDraft = JSON.stringify({
    detectedWords: ["alpha", "beta"],
    previewWords,
    selectedTerms: ["alpha"],
    step: "preview",
  });
  const storage = createStorage([[PHOTO_CAPTURE_DRAFT_KEY, rawDraft]]);

  assert.ok(rawDraft.length > 120_000);

  const draft = loadPhotoCaptureDraft(storage);

  assert.equal(draft.step, "preview");
  assert.deepEqual(draft.selectedTerms, ["alpha"]);
  assert.equal(draft.previewWords.length, previewWords.length);
  assert.equal(draft.imageDataUrl, "");
  assert.equal(draft.previewUrl, "");
  assert.deepEqual(storage.calls.removeItem, []);
});

test("loadPhotoCaptureDraft compacts oversized legacy image drafts without losing word data", () => {
  const rawDraft = JSON.stringify({
    detectedWords: ["ocean"],
    imageDataUrl: `data:image/jpeg;base64,${"a".repeat(125_000)}`,
    previewUrl: `data:image/jpeg;base64,${"b".repeat(125_000)}`,
    previewWords: [{ definition: "large body of water", enabled: true, id: "ocean-0", term: "ocean" }],
    selectedTerms: ["ocean"],
    step: "preview",
  });
  const storage = createStorage([[PHOTO_CAPTURE_DRAFT_KEY, rawDraft]]);

  const draft = loadPhotoCaptureDraft(storage);

  assert.equal(draft.step, "preview");
  assert.deepEqual(draft.detectedWords, ["ocean"]);
  assert.equal(draft.previewWords[0].term, "ocean");
  assert.equal(draft.imageDataUrl, "");
  assert.equal(draft.previewUrl, "");
  assert.deepEqual(storage.calls.removeItem, []);

  const [[storedKey, storedValue]] = storage.calls.setItem;
  assert.equal(storedKey, PHOTO_CAPTURE_DRAFT_KEY);
  const storedDraft = JSON.parse(storedValue);
  assert.equal(storedDraft.imageDataUrl, "");
  assert.equal(storedDraft.previewUrl, "");
  assert.equal(storedDraft.previewWords[0].term, "ocean");
  assert.ok(storedValue.length < 120_000);
});
