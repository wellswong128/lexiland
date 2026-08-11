import assert from "node:assert/strict";
import test from "node:test";
import {
  getPhotoCaptureDraftStorageKey,
  loadPhotoCaptureDraft,
  PHOTO_CAPTURE_DRAFT_KEY,
  savePhotoCaptureDraft,
} from "../src/lib/storage.js";

class MemoryStorage {
  constructor() {
    this.items = new Map();
  }

  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }

  removeItem(key) {
    this.items.delete(key);
  }

  setItem(key, value) {
    this.items.set(key, String(value));
  }
}

test("photo capture drafts are scoped to the signed-in user", () => {
  const storage = new MemoryStorage();
  const draft = {
    detectedWords: ["private"],
    previewWords: [{ term: "private", definition: "secret" }],
    selectedTerms: ["private"],
    step: "preview",
  };

  savePhotoCaptureDraft("user-a", draft, storage);

  assert.deepEqual(loadPhotoCaptureDraft("user-a", storage).previewWords, draft.previewWords);
  assert.equal(loadPhotoCaptureDraft("user-b", storage), null);
  assert.equal(loadPhotoCaptureDraft(null, storage), null);
  assert.equal(
    storage.getItem(getPhotoCaptureDraftStorageKey("user-a")).includes("private"),
    true,
  );
});

test("legacy unscoped photo drafts are cleared instead of restored", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    PHOTO_CAPTURE_DRAFT_KEY,
    JSON.stringify({
      detectedWords: ["legacy-private"],
      previewWords: [{ term: "legacy-private", definition: "secret" }],
      selectedTerms: ["legacy-private"],
      step: "preview",
    }),
  );

  assert.equal(loadPhotoCaptureDraft("user-b", storage), null);
  assert.equal(storage.getItem(PHOTO_CAPTURE_DRAFT_KEY), null);
});
