function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function getQuizOptionLabel(word) {
  const translation = String(word.translation ?? "").trim();
  return translation || word.definition;
}

export function createQuizQuestions(words, optionCount = 4) {
  const eligibleWords = words.filter((word) => getQuizOptionLabel(word));

  if (eligibleWords.length < 2) {
    return [];
  }

  return shuffleItems(eligibleWords).map((word) => {
    const wrongOptions = shuffleItems(
      eligibleWords.filter((candidate) => candidate.id !== word.id),
    )
      .slice(0, optionCount - 1)
      .map((candidate) => ({
        wordId: candidate.id,
        label: getQuizOptionLabel(candidate),
      }));

    const options = shuffleItems([
      { wordId: word.id, label: getQuizOptionLabel(word) },
      ...wrongOptions,
    ]);

    return {
      word,
      options,
      correctAnswer: word.id,
      correctLabel: getQuizOptionLabel(word),
    };
  });
}
