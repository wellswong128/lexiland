import SpeakButton from "./SpeakButton.jsx";
import WordMemoryPanel from "./WordMemoryPanel.jsx";

function ReviewWordListItem({
  actions = null,
  footer = null,
  memoryPanelCompact = true,
  showMemoryPanel = false,
  t,
  word,
}) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-blue-950">{word.term}</h2>
            <SpeakButton text={word.term} />
          </div>

          <div className="mt-2">
            <p className="review-word-field-label">{t("common.translation")}</p>
            {word.translation ? (
              <p className="review-word-translation">{word.translation}</p>
            ) : (
              <p className="text-sm font-semibold text-slate-400">{t("common.notYet")}</p>
            )}
          </div>

          {word.example ? (
            <div className="mt-3">
              <p className="review-word-field-label">{t("wordDetail.example")}</p>
              <p className="text-base leading-relaxed text-slate-700">{word.example}</p>
            </div>
          ) : null}

          {showMemoryPanel ? (
            <div className="mt-4">
              <WordMemoryPanel compact={memoryPanelCompact} word={word} />
            </div>
          ) : null}

          {footer}
        </div>

        {actions ? <div className="flex flex-wrap gap-3 sm:justify-end">{actions}</div> : null}
      </div>
    </li>
  );
}

export default ReviewWordListItem;
