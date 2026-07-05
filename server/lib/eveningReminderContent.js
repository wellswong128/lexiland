const TASK_LABELS = {
  reviewWords: {
    "zh-HK": "複習 5 個單字",
    en: "Review 5 words",
  },
  playGame: {
    "zh-HK": "玩 1 次學習遊戲",
    en: "Play 1 learning game",
  },
  clearMistakes: {
    "zh-HK": "清除 3 個錯題",
    en: "Clear 3 mistakes",
  },
};

function resolveLocale(locale) {
  const normalized = String(locale || "").trim();
  return normalized.startsWith("zh") ? "zh-HK" : "en";
}

function getAppUrl() {
  return (
    String(process.env.SITE_URL || process.env.VITE_APP_URL || "https://learn.lexiland.cc")
      .trim()
      .replace(/\/$/, "") || "https://learn.lexiland.cc"
  );
}

function formatTaskLabels(pendingTaskLabels, localeKey) {
  const labels = Array.isArray(pendingTaskLabels) ? pendingTaskLabels : [];

  return labels
    .map((taskId) => TASK_LABELS[taskId]?.[localeKey] || taskId)
    .filter(Boolean);
}

export function buildEveningReminderEmail({
  locale = "zh-HK",
  streak = 0,
  pendingTaskLabels = [],
  dailyTasksCompleted = 0,
  dailyTasksTotal = 3,
  hasSnapshot = false,
}) {
  const localeKey = resolveLocale(locale);
  const appUrl = getAppUrl();
  const tasks = formatTaskLabels(pendingTaskLabels, localeKey);
  const isZh = localeKey === "zh-HK";

  const subject = isZh
    ? "力思樂園：今晚還有學習任務未完成 🌙"
    : "LexiLand: You still have learning tasks tonight 🌙";

  const intro = isZh
    ? "嗨！今天快要結束了，你的每日學習任務還沒全部完成。"
    : "Hi! The day is almost over and you have not finished all of your daily learning tasks yet.";

  const progressLine = hasSnapshot
    ? isZh
      ? `今日進度：${dailyTasksCompleted}/${dailyTasksTotal} 項任務已完成。`
      : `Today's progress: ${dailyTasksCompleted}/${dailyTasksTotal} tasks completed.`
    : isZh
      ? "打開力思樂園，完成今天的學習任務吧！"
      : "Open LexiLand and finish today's learning tasks.";

  const streakLine =
    streak > 0
      ? isZh
        ? `你目前的連續學習天數是 ${streak} 天，今晚完成任務就能保住連續紀錄！`
        : `Your current streak is ${streak} days. Finish tonight to keep it going!`
      : isZh
        ? "今晚開始學習，建立你的連續學習紀錄吧！"
        : "Start learning tonight and build your streak.";

  const tasksHeading = isZh ? "尚未完成的任務：" : "Tasks still to do:";
  const tasksHtml =
    tasks.length > 0
      ? `<ul>${tasks.map((label) => `<li>${label}</li>`).join("")}</ul>`
      : isZh
        ? "<p>複習單字、玩遊戲，或清理錯題本。</p>"
        : "<p>Review words, play a game, or clear mistakes.</p>";

  const ctaLabel = isZh ? "繼續學習" : "Continue learning";
  const footer = isZh
    ? "你可在設定中關閉晚間提醒。You can turn off evening reminders in Settings."
    : "You can turn off evening reminders in Settings.";

  const html = [
    `<h2>${isZh ? "力思樂園 LexiLand" : "LexiLand"}</h2>`,
    `<p>${intro}</p>`,
    `<p>${progressLine}</p>`,
    `<p>${streakLine}</p>`,
    `<p><strong>${tasksHeading}</strong></p>`,
    tasksHtml,
    `<p><a href="${appUrl}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:999px;font-weight:bold;">${ctaLabel}</a></p>`,
    `<p style="color:#64748b;font-size:13px;">${footer}</p>`,
  ].join("");

  const textTasks =
    tasks.length > 0
      ? tasks.map((label) => `- ${label}`).join("\n")
      : isZh
        ? "- 複習、遊戲或錯題本"
        : "- Review, games, or mistakes";

  const text = [
    intro,
    "",
    progressLine,
    streakLine,
    "",
    tasksHeading,
    textTasks,
    "",
    `${ctaLabel}: ${appUrl}`,
    "",
    footer,
  ].join("\n");

  return { subject, html, text };
}
