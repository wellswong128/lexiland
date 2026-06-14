import SpeakButton from "./SpeakButton.jsx";

function GameWordWithSpeak({ as: Tag = "div", className = "", text }) {
  if (!text) {
    return null;
  }

  return (
    <Tag className={["game-word-with-speak", className].filter(Boolean).join(" ")}>
      <span className="game-word-with-speak-text">{text}</span>
      <SpeakButton className="game-word-speak-btn" text={text} />
    </Tag>
  );
}

export default GameWordWithSpeak;
