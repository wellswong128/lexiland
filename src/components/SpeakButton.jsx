import { useLocale } from "../features/locale/LocaleContext.jsx";

function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function runSpeech(text) {
  window.speechSynthesis.resume();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

function speakText(text) {
  if (!canSpeak() || !text.trim()) {
    return;
  }

  const value = text.trim();

  window.setTimeout(() => {
    window.speechSynthesis.cancel();
    runSpeech(value);
  }, 50);
}

function primeSpeechSynthesis() {
  if (!canSpeak()) {
    return;
  }

  window.speechSynthesis.getVoices();
  window.speechSynthesis.resume();
}

/** Call synchronously inside a user gesture (e.g. button click) so iOS allows later speech. */
function unlockSpeechSynthesis() {
  if (!canSpeak()) {
    return;
  }

  primeSpeechSynthesis();

  const utterance = new SpeechSynthesisUtterance("\u200b");
  utterance.volume = 0.01;
  utterance.rate = 10;
  window.speechSynthesis.speak(utterance);
}

function SpeakButton({ className = "", text }) {
  const { t } = useLocale();
  const label = t("common.speak");
  const disabled = !text?.trim() || !canSpeak();

  return (
    <button
      aria-label={`${label}: ${text}`}
      title={`${label}: ${text}`}
      className={[
        "inline-flex size-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition hover:bg-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
        className,
      ].join(" ")}
      disabled={disabled}
      onClick={() => speakText(text)}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M4 9v6h4l5 4V5L8 9H4Z" />
        <path d="M16 9.5a4 4 0 0 1 0 5" />
        <path d="M18.5 7a7 7 0 0 1 0 10" />
      </svg>
    </button>
  );
}

export { primeSpeechSynthesis, speakText, unlockSpeechSynthesis };
export default SpeakButton;
