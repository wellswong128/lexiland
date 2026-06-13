import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GameHomeButton from "../components/GameHomeButton.jsx";
import GameMistakeSummary from "../components/GameMistakeSummary.jsx";
import GameWordBankStatus from "../components/GameWordBankStatus.jsx";
import LanguageToggle from "../components/LanguageToggle.jsx";
import {
  buildGameWordBank,
  pickRandomEntry,
  shuffleArray,
} from "../features/games/gameWordBank.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useGameMistakeTracker } from "../features/review/useGameMistakeTracker.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const gateColors = [
  ["#ef4444", "#991b1b"],
  ["#22c55e", "#166534"],
  ["#3b82f6", "#1e3a8a"],
  ["#a855f7", "#581c87"],
];

const demoGates = ["蘋果", "學校", "朋友", "未來"];

const treeSeeds = [
  { left: 5, delay: 0 },
  { left: 93, delay: 0.3 },
  { left: 10, delay: 0.7 },
  { left: 88, delay: 1.1 },
];

const maxTime = 60;

function playTone(freq, duration, type = "sine", volume = 0.035) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio is optional.
  }
}

function createQuestion(entries, priorityWordIds) {
  const question = pickRandomEntry(entries, priorityWordIds);

  if (!question) {
    return null;
  }

  const wrongChoices = shuffleArray(
    entries.filter((item) => item.word !== question.word),
  ).slice(0, 3);

  return {
    question,
    choices: shuffleArray([question, ...wrongChoices]),
    selectedLane: Math.floor(Math.random() * 4),
  };
}

function Kart({ lane, state = "" }) {
  return (
    <div className={["word-kart-kart", state].filter(Boolean).join(" ")} style={{ "--lane": lane }}>
      <div className="word-kart-driver-head" />
      <div className="word-kart-kart-front" />
      <div className="word-kart-kart-body" />
      <div className="word-kart-wheel left" />
      <div className="word-kart-wheel right" />
      <div className="word-kart-flame" />
    </div>
  );
}

function Gate({ text, colorIndex, state = "" }) {
  const [colorA, colorB] = gateColors[colorIndex % gateColors.length];

  return (
    <div
      className={["word-kart-gate", state].filter(Boolean).join(" ")}
      style={{ "--gate-a": colorA, "--gate-b": colorB }}
    >
      {text}
    </div>
  );
}

function RaceDecorations() {
  return (
    <>
      {treeSeeds.map((tree) => (
        <div
          className="word-kart-tree"
          key={`tree-${tree.left}`}
          style={{ animationDelay: `${tree.delay}s`, left: `${tree.left}%` }}
        />
      ))}
    </>
  );
}

function WordKartPage() {
  const { t } = useLocale();
  const { words } = useWordsContext();
  const { commitMistakes, lastCommittedTerms, recordWrong, resetTracker } =
    useGameMistakeTracker();

  const { entries, priorityCount, priorityWordIds, usingFallback } = useMemo(
    () => buildGameWordBank(words, { minWords: 4 }),
    [words],
  );

  const [gameState, setGameState] = useState("start");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(maxTime);
  const [round, setRound] = useState(1);
  const [speedLevel, setSpeedLevel] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [reviewItems, setReviewItems] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);
  const [selectedLane, setSelectedLane] = useState(1);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState({ text: "", type: "" });
  const [gateStates, setGateStates] = useState({});
  const [kartState, setKartState] = useState("");

  const startGame = useCallback(() => {
    resetTracker();
    const firstRound = createQuestion(entries, priorityWordIds);

    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimeLeft(maxTime);
    setRound(1);
    setSpeedLevel(1);
    setCorrectCount(0);
    setWrongCount(0);
    setReviewItems([]);
    setLocked(false);
    setStatus({ text: "", type: "" });
    setGateStates({});
    setKartState("");
    setCurrentRound(firstRound);
    setSelectedLane(firstRound.selectedLane);
    setGameState("playing");
  }, [entries, priorityWordIds, resetTracker]);

  const endGame = useCallback(() => {
    commitMistakes();
    setGameState("over");
    setLocked(true);
  }, [commitMistakes]);

  const resetOptionState = useCallback(() => {
    setLocked(false);
    setGateStates({});
    setKartState("");
  }, []);

  const nextQuestion = useCallback(() => {
    const nextRound = createQuestion(entries, priorityWordIds);

    resetOptionState();
    setStatus({ text: "", type: "" });
    setCurrentRound(nextRound);
    setSelectedLane(nextRound.selectedLane);
  }, [entries, priorityWordIds, resetOptionState]);

  const checkLane = useCallback(
    (lane) => {
      if (!currentRound) return;

      const choice = currentRound.choices[lane];
      const isCorrect = choice?.word === currentRound.question.word;

      if (isCorrect) {
        setGateStates({ [lane]: "correct-flash" });
        setKartState("boost");
        setCombo((value) => {
          const nextCombo = value + 1;
          setBestCombo((best) => Math.max(best, nextCombo));
          setSpeedLevel(Math.min(5, 1 + Math.floor(nextCombo / 3)));
          setScore(
            (scoreValue) =>
              scoreValue +
              100 +
              nextCombo * 15 +
              Math.min(5, 1 + Math.floor(nextCombo / 3)) * 10,
          );
          return nextCombo;
        });
        setCorrectCount((value) => value + 1);
        setStatus({ text: t("games.correct"), type: "good" });
        playTone(660, 0.08, "triangle", 0.04);
        window.setTimeout(() => playTone(920, 0.1, "triangle", 0.04), 90);
        window.setTimeout(() => {
          setRound((value) => value + 1);
          nextQuestion();
        }, 760);
        return;
      }

      setGateStates({ [lane]: "wrong-flash" });
      setKartState("crash");
      recordWrong(currentRound.question.word);
      setCombo(0);
      setSpeedLevel(1);
      setWrongCount((value) => value + 1);
      setTimeLeft((value) => Math.max(0, value - 5));
      setReviewItems((current) => {
        if (current.some((item) => item.word === currentRound.question.word)) {
          return current;
        }

        return [...current, currentRound.question];
      });
      setStatus({
        text: t("games.wordKart.wrong", { answer: currentRound.question.meaning }),
        type: "bad",
      });
      playTone(160, 0.16, "sawtooth", 0.035);

      window.setTimeout(() => {
        setTimeLeft((value) => {
          if (value <= 0) {
            endGame();
            return 0;
          }

          setRound((roundValue) => roundValue + 1);
          nextQuestion();
          return value;
        });
      }, 900);
    },
    [currentRound, endGame, nextQuestion, recordWrong, t],
  );

  const chooseLane = useCallback(
    (lane) => {
      if (locked || !currentRound) return;

      setLocked(true);
      setSelectedLane(lane);
      window.setTimeout(() => checkLane(lane), 220);
    },
    [checkLane, currentRound, locked],
  );

  useEffect(() => {
    if (gameState !== "playing" || locked) return undefined;

    const timerId = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timerId);
          endGame();
          return 0;
        }

        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [endGame, gameState, locked]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (gameState !== "playing" || locked) return;

      if (["1", "2", "3", "4"].includes(event.key)) {
        chooseLane(Number(event.key) - 1);
        return;
      }

      if (event.key === "ArrowLeft") {
        setSelectedLane((lane) => Math.max(0, lane - 1));
      }

      if (event.key === "ArrowRight") {
        setSelectedLane((lane) => Math.min(3, lane + 1));
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseLane(selectedLane);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [chooseLane, gameState, locked, selectedLane]);

  const timerPercent = Math.max(0, (timeLeft / maxTime) * 100);
  const totalAttempts = correctCount + wrongCount;
  const accuracy =
    totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
  const isFast = speedLevel >= 3;

  return (
    <section className="word-kart-app flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] p-2 sm:p-4">
      <header className="relative z-50 mb-2 flex shrink-0 items-center justify-between gap-2">
        {gameState === "playing" ? <GameHomeButton /> : <div className="min-w-[4.5rem]" />}
        <div className="pointer-events-none flex-1 text-center">
          <h1 className="text-3xl font-black text-orange-50 drop-shadow sm:text-5xl">
            {t("games.wordKart.title")}
          </h1>
          <p className="text-xs text-sky-100 sm:text-sm">
            {t("games.wordKart.subtitle")}
          </p>
        </div>
        <div className="relative z-50 flex min-w-[4.5rem] items-center justify-end">
          <LanguageToggle />
        </div>
      </header>

      {gameState === "playing" ? (
        <>
          <div className="mb-1.5 grid grid-cols-5 gap-1.5">
            {[
              [t("games.score"), score, "text-yellow-300"],
              [t("games.combo"), combo, "text-green-300"],
              [t("games.time"), timeLeft, "text-orange-200"],
              [t("games.speed"), `${speedLevel}x`, "text-sky-300"],
              [t("games.round"), round, "text-purple-200"],
            ].map(([label, value, color]) => (
              <div className="word-kart-stat" key={label}>
                <p className="text-xs font-bold uppercase text-sky-200 sm:text-xs">
                  {label}
                </p>
                <p className={`text-sm font-black sm:text-xl ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full border border-white/20 bg-slate-950/40">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${timerPercent}%`,
                background:
                  timerPercent < 22
                    ? "linear-gradient(90deg, #ef4444, #fb923c)"
                    : timerPercent < 50
                      ? "linear-gradient(90deg, #f97316, #fde047)"
                      : "linear-gradient(90deg, #22c55e, #fde047)",
              }}
            />
          </div>
        </>
      ) : null}

      <div className="word-kart-card relative z-0 min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
        {gameState === "start" ? (
          <div className="flex h-full flex-col text-center">
            <div className={`word-kart-race-area relative min-h-0 flex-1 ${isFast ? "fast" : ""}`}>
              <div className="word-kart-sun" />
              <div className="word-kart-cloud" />
              <RaceDecorations />
              <div className="word-kart-prompt-panel">
                <p className="word-kart-prompt-label">{t("games.demoMode")}</p>
                <p className="word-kart-prompt-word">{t("games.wordKart.title")}</p>
                <p className="word-kart-prompt-type">{t("games.wordKart.vocabularyRacing")}</p>
              </div>
              <div className="word-kart-track" />
              <div className="word-kart-answer-gates">
                {demoGates.map((text, index) => (
                  <Gate colorIndex={index} key={text} text={text} />
                ))}
              </div>
              <div className="word-kart-kart-wrap">
                <Kart lane={1} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-sky-100">
                {t("games.wordKart.startHint")}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button className="word-kart-primary-btn" onClick={startGame} type="button">
                  {t("games.startGame")}
                </button>
                <Link className="word-kart-secondary-btn" to="/">
                  {t("common.home")}
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {gameState === "playing" && currentRound ? (
          <div className={`word-kart-race-area relative h-full min-h-0 ${isFast ? "fast" : ""}`}>
            <div className="word-kart-sun" />
            <div className="word-kart-cloud" />
            <RaceDecorations />
            <div className="word-kart-prompt-panel">
              <p className="word-kart-prompt-label">{t("games.wordKart.prompt")}</p>
              <p className="word-kart-prompt-word">{currentRound.question.word}</p>
              <p className="word-kart-prompt-type">
                {t("games.partOfSpeech", { type: currentRound.question.type })}
              </p>
              <p
                className={[
                  "word-kart-status",
                  status.type === "good" ? "good" : "",
                  status.type === "bad" ? "bad" : "",
                ].join(" ")}
              >
                {status.text}
              </p>
            </div>
            <div className="word-kart-track" />
            <div className="word-kart-answer-gates" key={round}>
              {currentRound.choices.map((choice, index) => (
                <Gate
                  colorIndex={index}
                  key={`${choice.word}-${index}`}
                  state={gateStates[index] ?? ""}
                  text={choice.meaning}
                />
              ))}
            </div>
            <div className="word-kart-controls" key={`controls-${round}`}>
              {currentRound.choices.map((choice, index) => (
                <button
                  className="word-kart-lane-btn"
                  disabled={locked}
                  key={`lane-${choice.word}-${index}`}
                  onClick={() => chooseLane(index)}
                  type="button"
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="word-kart-kart-wrap">
              <Kart lane={selectedLane} state={kartState} />
            </div>
          </div>
        ) : null}

        {gameState === "over" ? (
          <div className="flex h-full flex-col overflow-y-auto text-center">
            <div className="word-kart-race-area relative min-h-[14rem] shrink-0">
              <div className="word-kart-sun" />
              <div className="word-kart-cloud" />
              <RaceDecorations />
              <div className="word-kart-prompt-panel">
                <p className="word-kart-prompt-label">{t("games.gameOver")}</p>
                <p className="word-kart-prompt-word">{t("games.result")}</p>
                <p className="word-kart-status">
                  {t("games.wordKart.resultCount", { count: correctCount })}
                </p>
              </div>
              <div className="word-kart-track" />
              <div className="word-kart-answer-gates">
                {demoGates.map((text, index) => (
                  <Gate colorIndex={index} key={text} text={text} />
                ))}
              </div>
              <div className="word-kart-kart-wrap">
                <Kart lane={1} />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                [t("games.score"), score],
                [t("games.correct"), correctCount],
                [t("games.bestCombo"), bestCombo],
                [t("games.accuracy"), `${accuracy}%`],
              ].map(([label, value]) => (
                <div className="word-kart-summary-card" key={label}>
                  <p className="text-xs font-bold uppercase text-sky-200">
                    {label}
                  </p>
                  <p className="text-2xl font-black text-yellow-300">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-white/15 bg-slate-950/35 p-3 text-left">
              <h3 className="font-black text-sky-100">{t("games.wordsToReview")}</h3>
              {reviewItems.length === 0 ? (
                <p className="mt-1 text-sm text-sky-200">{t("games.perfectNoMistakes")}</p>
              ) : (
                <ul className="mt-2 grid max-h-24 gap-1.5 overflow-y-auto">
                  {reviewItems.map((item) => (
                    <li
                      className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
                      key={item.word}
                    >
                      <span className="font-black text-yellow-300">{item.word}</span>
                      <span className="mx-2 text-sky-400">→</span>
                      <span className="text-sky-100">{item.meaning}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <GameMistakeSummary className="mt-3 text-left" terms={lastCommittedTerms} />

            <div className="mt-3 flex flex-wrap justify-center gap-2 pb-1">
              <button className="word-kart-primary-btn" onClick={startGame} type="button">
                {t("games.playAgain")}
              </button>
              <Link className="word-kart-secondary-btn" to="/">
                {t("common.home")}
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {gameState === "playing" ? null : (
        <GameWordBankStatus
          className="mt-2 block text-center text-xs text-sky-100"
          priorityCount={priorityCount}
          usingFallback={usingFallback}
        />
      )}
    </section>
  );
}

export default WordKartPage;
