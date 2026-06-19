import { useLocale } from "../features/locale/LocaleContext.jsx";
import SpeakButton from "./SpeakButton.jsx";

function ExampleSentence({
  className = "",
  example,
  exampleTranslation,
  showLabel = true,
}) {
  const { t } = useLocale();

  if (!example) {
    return null;
  }

  return (
    <div className={className}>
      {showLabel ? (
        <p className="review-word-field-label">{t("wordDetail.example")}</p>
      ) : null}
      <div className="flex flex-wrap items-start gap-2">
        <p className="min-w-0 flex-1 text-base leading-relaxed text-slate-700">{example}</p>
        <SpeakButton text={example} />
      </div>
      <div className="mt-2">
        <p className="review-word-field-label">{t("addWord.exampleTranslation")}</p>
        {exampleTranslation ? (
          <p className="review-word-translation mt-1">{exampleTranslation}</p>
        ) : (
          <p className="mt-1 text-sm font-semibold text-slate-400">{t("common.notYet")}</p>
        )}
      </div>
    </div>
  );
}

export default ExampleSentence;
