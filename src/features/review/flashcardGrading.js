import { REVIEW_RESULTS } from "../words/wordTypes.js";

export function getImmediateImageReviewResult(answerWordId, correctAnswer) {
  if (!answerWordId || !correctAnswer) {
    return null;
  }

  return answerWordId === correctAnswer ? REVIEW_RESULTS.REMEMBERED : null;
}
