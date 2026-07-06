import { readWordMemoryImage } from "../words/wordImageApi.js";
import { hasMemoryImageUrl } from "../words/memoryImageUtils.js";
import { getQuizOptionLabel } from "./quizHelpers.js";

function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function wordHasMemoryImage(word) {
  return hasMemoryImageUrl(readWordMemoryImage(word));
}

export function getImageReviewReadiness(sessionWords, allWords) {
  const missingSessionWords = sessionWords.filter((word) => !wordHasMemoryImage(word));
  const eligibleCount = sessionWords.length - missingSessionWords.length;
  const poolCount = allWords.filter(wordHasMemoryImage).length;
  const needsMorePoolWords = poolCount < 2;

  return {
    canStart: eligibleCount > 0 && !needsMorePoolWords,
    poolCount,
    eligibleCount,
    missingSessionWords,
    needsMorePoolWords,
  };
}

export function getFlashcardReviewReadiness(sessionWords, allWords) {
  const imageReadiness = getImageReviewReadiness(sessionWords, allWords);
  const canStartImageMode = imageReadiness.canStart;
  const willUseMixedMode =
    canStartImageMode && imageReadiness.missingSessionWords.length > 0;
  const willUseTextMode = sessionWords.length > 0 && !canStartImageMode;

  return {
    ...imageReadiness,
    canStart: sessionWords.length > 0,
    canStartImageMode,
    willUseMixedMode,
    willUseTextMode,
  };
}

export function createTextFlashcardQuestions(sessionWords) {
  if (!Array.isArray(sessionWords) || sessionWords.length === 0) {
    return [];
  }

  return shuffleItems(sessionWords).map((word) => ({
    mode: "text",
    word,
  }));
}

export function createMixedFlashcardQuestions(sessionWords, allWords, optionCount = 4) {
  if (!Array.isArray(sessionWords) || sessionWords.length === 0) {
    return [];
  }

  const imageQuestions = createImageQuizQuestions(sessionWords, allWords, optionCount);
  const imageWordIds = new Set(imageQuestions.map((question) => question.word.id));
  const textOnlyWords = sessionWords.filter((word) => !imageWordIds.has(word.id));
  const textQuestions = createTextFlashcardQuestions(textOnlyWords);

  if (imageQuestions.length === 0) {
    return textQuestions;
  }

  if (textQuestions.length === 0) {
    return imageQuestions;
  }

  return shuffleItems([...imageQuestions, ...textQuestions]);
}

export function createImageQuizQuestions(sessionWords, allWords, optionCount = 4) {
  const imagePool = allWords.filter(wordHasMemoryImage);
  const eligibleSessionWords = sessionWords.filter(wordHasMemoryImage);

  if (eligibleSessionWords.length === 0 || imagePool.length < 2) {
    return [];
  }

  return shuffleItems(eligibleSessionWords).map((word) => {
    const correctImageUrl = readWordMemoryImage(word).imageUrl;
    const wrongCandidates = shuffleItems(
      imagePool.filter((candidate) => candidate.id !== word.id),
    );
    const wrongOptions = wrongCandidates
      .slice(0, optionCount - 1)
      .map((candidate) => ({
        wordId: candidate.id,
        imageUrl: readWordMemoryImage(candidate).imageUrl,
        translation: getQuizOptionLabel(candidate),
      }));

    const options = shuffleItems([
      {
        wordId: word.id,
        imageUrl: correctImageUrl,
        translation: getQuizOptionLabel(word),
      },
      ...wrongOptions,
    ]);

    return {
      word,
      mode: "image",
      options,
      correctAnswer: word.id,
    };
  });
}
