function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function speakText(text) {
  if (!canSpeak() || !text.trim()) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;

  window.speechSynthesis.speak(utterance);
}

function SpeakButton({ className = "", label = "Speak", text }) {
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

export default SpeakButton;
