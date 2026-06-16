import { readWordMemoryImage } from "../words/wordImageApi.js";

function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function wordHasMemoryImage(word) {
  return Boolean(readWordMemoryImage(word)?.imageUrl);
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
      }));

    const options = shuffleItems([
      { wordId: word.id, imageUrl: correctImageUrl },
      ...wrongOptions,
    ]);

    return {
      word,
      options,
      correctAnswer: word.id,
    };
  });
}
