import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useActiveGroupWordScope } from "../features/wordGroups/useActiveGroupWordScope.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { getLearningReport } from "../lib/learningReport.js";

function ReportStatCard({ description, emoji, label, value }) {
  return (
    <article className="learning-report-stat">
      <div className="learning-report-stat-top">
        <span aria-hidden="true" className="learning-report-stat-emoji">
          {emoji}
        </span>
        <p className="learning-report-stat-label">{label}</p>
      </div>
      <p className="learning-report-stat-value">{value}</p>
      {description ? <p className="learning-report-stat-desc">{description}</p> : null}
    </article>
  );
}

function LearningReportPage() {
  const { dateLocale, t } = useLocale();
  const { user, words } = useWordsContext();
  const { isGroupScopeActive, scopedWords } = useActiveGroupWordScope(words, user);
  const learningWords = isGroupScopeActive ? scopedWords : words;
  const report = useMemo(() => getLearningReport(learningWords), [learningWords]);

  const weekRangeLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(dateLocale, {
      month: "short",
      day: "numeric",
    });

    return t("learningReport.weekRange", {
      end: formatter.format(new Date(report.weekEndDate)),
      start: formatter.format(new Date(report.weekStartDate)),
    });
  }, [dateLocale, report.weekEndDate, report.weekStartDate, t]);

  return (
    <div className="learning-report-page">
      <header className="learning-report-hero">
        <div className="learning-report-hero-top">
          <span aria-hidden="true" className="learning-report-hero-icon">
            📊
          </span>
          <div>
            <p className="learning-report-eyebrow">{t("learningReport.eyebrow")}</p>
            <h1 className="learning-report-title">{t("learningReport.title")}</h1>
            <p className="learning-report-subtitle">{t("learningReport.subtitle")}</p>
          </div>
        </div>
        <p className="learning-report-week">{weekRangeLabel}</p>
      </header>

      <section aria-labelledby="learning-report-stats-title" className="learning-report-section">
        <h2 className="learning-report-section-title" id="learning-report-stats-title">
          {t("learningReport.statsTitle")}
        </h2>
        <div className="learning-report-stats">
          <ReportStatCard
            description={t("learningReport.wordsAddedThisWeekDesc")}
            emoji="📚"
            label={t("learningReport.wordsAddedThisWeek")}
            value={report.wordsAddedThisWeek}
          />
          <ReportStatCard
            description={t("learningReport.streakDesc")}
            emoji="🔥"
            label={t("learningReport.streak")}
            value={t("learningReport.streakValue", { count: report.streakDays })}
          />
          <ReportStatCard
            description={t("learningReport.gamesThisWeekDesc", {
              total: report.gamesCompletedTotal,
            })}
            emoji="🎮"
            label={t("learningReport.gamesThisWeek")}
            value={report.gamesCompletedThisWeek}
          />
          <ReportStatCard
            description={t("learningReport.reviewedThisWeekDesc")}
            emoji="📒"
            label={t("learningReport.reviewedThisWeek")}
            value={report.wordsReviewedThisWeek}
          />
        </div>
        <p className="learning-report-total-words">
          {t("learningReport.totalWords", { count: report.totalWords })}
        </p>
      </section>

      <section aria-labelledby="learning-report-mistakes-title" className="learning-report-section">
        <div className="learning-report-section-header">
          <h2 className="learning-report-section-title" id="learning-report-mistakes-title">
            {t("learningReport.topMistakesTitle")}
          </h2>
          <p className="learning-report-section-desc">{t("learningReport.topMistakesDesc")}</p>
        </div>

        {report.topMistakeWords.length > 0 ? (
          <ol className="learning-report-mistake-list">
            {report.topMistakeWords.map((item, index) => (
              <li className="learning-report-mistake-item" key={item.word.id}>
                <span aria-hidden="true" className="learning-report-mistake-rank">
                  {index + 1}
                </span>
                <div className="learning-report-mistake-copy">
                  <Link className="learning-report-mistake-term" to={`/words/${item.word.id}`}>
                    {item.word.term}
                  </Link>
                  {item.word.translation ? (
                    <p className="learning-report-mistake-translation">{item.word.translation}</p>
                  ) : null}
                </div>
                <div className="learning-report-mistake-meta">
                  <span className="learning-report-mistake-count">
                    {t("learningReport.mistakeCount", { count: item.mistakeCount })}
                  </span>
                  {item.isActiveMistake ? (
                    <span className="learning-report-mistake-badge">
                      {t("learningReport.activeMistake")}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="learning-report-empty">
            <p>{t("learningReport.noMistakesYet")}</p>
          </div>
        )}

        {report.activeMistakeCount > 0 ? (
          <Link className="learning-report-action" to="/mistakes">
            {t("learningReport.reviewMistakesCta", { count: report.activeMistakeCount })}
          </Link>
        ) : null}
      </section>

      <section className="learning-report-footer">
        <Link className="learning-report-secondary-link" to="/achievements">
          {t("learningReport.viewAchievements")}
        </Link>
        <Link className="learning-report-secondary-link" to="/">
          {t("common.home")}
        </Link>
      </section>
    </div>
  );
}

export default LearningReportPage;
