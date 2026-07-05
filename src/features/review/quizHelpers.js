function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

export const QUIZ_SESSION_QUESTION_COUNT = 10;

export function getQuizOptionLabel(word) {
  const translation = String(word.translation ?? "").trim();
  return translation || word.definition;
}

export function createQuizQuestions(
  words,
  { optionCount = 4, questionCount = QUIZ_SESSION_QUESTION_COUNT } = {},
) {
  const eligibleWords = words.filter((word) => getQuizOptionLabel(word));

  if (eligibleWords.length < 2) {
    return [];
  }

  const sessionWords = shuffleItems(eligibleWords).slice(
    0,
    Math.min(questionCount, eligibleWords.length),
  );

  return sessionWords.map((word) => {
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
