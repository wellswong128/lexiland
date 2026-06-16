import { useEffect } from "react";
import SpeakButton, { speakText } from "./SpeakButton.jsx";

function GameWordWithSpeak({
  as: Tag = "div",
  autoSpeak = true,
  className = "",
  speakAs = null,
  text,
}) {
  const speechText = speakAs ?? text;

  useEffect(() => {
    if (!autoSpeak || !speechText?.trim()) {
      return;
    }

    speakText(speechText);
  }, [autoSpeak, speechText]);

  if (!text) {
    return null;
  }

  return (
    <Tag className={["game-word-with-speak", className].filter(Boolean).join(" ")}>
      <span className="game-word-with-speak-text">{text}</span>
      <SpeakButton className="game-word-speak-btn" text={speechText} />
    </Tag>
  );
}

export default GameWordWithSpeak;
