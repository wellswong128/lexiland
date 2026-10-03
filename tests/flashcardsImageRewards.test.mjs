import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

function extractFunctionBody(source, functionName) {
  const startToken = `function ${functionName}`;
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `${functionName} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart + 1, index);
      }
    }
  }

  assert.fail(`${functionName} body should close`);
}

test("image flashcard misses still record review rewards before showing incorrect panel", () => {
  const source = readFileSync(new URL("../src/pages/FlashcardsPage.jsx", import.meta.url), "utf8");
  const body = extractFunctionBody(source, "handleImageAnswer");

  const updateIndex = body.indexOf("updateWord(currentQuestion.word.id, updateReviewResult(currentQuestion.word, result));");
  const rewardIndex = body.indexOf("recordFlashcardRewards(currentQuestion.word, result, hadMistake);");
  const incorrectIndex = body.indexOf("if (!isCorrect)");

  assert.notEqual(updateIndex, -1, "image answers should persist SRS progress");
  assert.notEqual(rewardIndex, -1, "image answers should record review rewards");
  assert.notEqual(incorrectIndex, -1, "image answers should keep the incorrect branch");
  assert.ok(
    updateIndex < rewardIndex && rewardIndex < incorrectIndex,
    "review rewards must be recorded after SRS update and before the incorrect-answer early return",
  );
});
