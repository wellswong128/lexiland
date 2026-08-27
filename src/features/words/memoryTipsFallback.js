export function createDemoMemoryTips(word, locale = "zh-Hant") {
  const term = word.term.trim();
  const isEnglish = locale === "en";

  if (isEnglish) {
    return {
      summary: `Break "${term}" into smaller pieces and attach it to a vivid image.`,
      tips: [
        {
          method: "Sound Link",
          content: `Say "${term}" aloud three times, then link its first syllable to a familiar English word you already know.`,
        },
        {
          method: "Sentence Hook",
          content: word.example
            ? `Reuse the example sentence and underline "${term}" each time you read it.`
            : `Make one short sentence with "${term}" about your daily life.`,
        },
        {
          method: "Review Trick",
          content: "Cover the translation, recall the meaning, then say the word again within 10 seconds.",
        },
      ],
    };
  }

  const isSimplified = locale === "zh-Hans";
  const summary = isSimplified
    ? `把 "${term}" 和一个具体画面绑在一起，比死记拼写更有效。`
    : `把「${term}」和一個具體畫面綁在一起，比死記拼寫更有效。`;

  return {
    summary,
    tips: [
      {
        method: isSimplified ? "谐音联想" : "諧音聯想",
        content: isSimplified
          ? `先大声读 "${term}"，再找一个发音相近的中文词，想象它们出现在同一个画面里。`
          : `先大聲讀「${term}」，再找一個發音相近的中文詞，想像它們出現在同一個畫面裡。`,
      },
      {
        method: isSimplified ? "例句记忆" : "例句記憶",
        content: word.example
          ? isSimplified
            ? `反复朗读例句：${word.example}，每次读到 "${term}" 都停一下。`
            : `反覆朗讀例句：${word.example}，每次讀到「${term}」都停一下。`
          : isSimplified
            ? `自己造一个包含 "${term}" 的短句，并立刻口头复述三遍。`
            : `自己造一個包含「${term}」的短句，並立刻口頭複述三遍。`,
      },
      {
        method: isSimplified ? "复习技巧" : "複習技巧",
        content: isSimplified
          ? "遮住中文释义，先回忆英文单词，再回忆意思，10 秒内完成才算记住。"
          : "遮住中文釋義，先回憶英文單字，再回憶意思，10 秒內完成才算記住。",
      },
    ],
  };
}

export function createFallbackMemoryTipsResult(word, locale, error) {
  return {
    memoryTips: createDemoMemoryTips(word, locale),
    usedFallback: true,
    fallbackReason: error.message,
    changes: null,
    fromCache: false,
    fromWordbase: false,
  };
}
