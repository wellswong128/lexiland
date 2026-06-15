import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import GameHomeButton from "../components/GameHomeButton.jsx";
import GameMistakeSummary from "../components/GameMistakeSummary.jsx";
import GameWordBankStatus from "../components/GameWordBankStatus.jsx";
import GameWordWithSpeak from "../components/GameWordWithSpeak.jsx";
import {
  pickRandomEntry,
  shuffleArray,
  shouldUseGamePlan,
} from "../features/games/gameWordBank.js";
import { useReviewSessionPlay } from "../features/games/useReviewSessionPlay.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useGameMistakeTracker } from "../features/review/useGameMistakeTracker.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const fishColors = [
  ["#fb7185", "#f97316"],
  ["#22c55e", "#06b6d4"],
  ["#a855f7", "#6366f1"],
  ["#facc15", "#f59e0b"],
  ["#38bdf8", "#2563eb"],
  ["#f472b6", "#ec4899"],
];

const fishLayouts = [
  [
    { x: 22, y: 32 },
    { x: 73, y: 34 },
    { x: 33, y: 69 },
    { x: 78, y: 72 },
  ],
  [
    { x: 28, y: 36 },
    { x: 70, y: 29 },
    { x: 24, y: 74 },
    { x: 68, y: 70 },
  ],
  [
    { x: 18, y: 52 },
    { x: 50, y: 32 },
    { x: 82, y: 50 },
    { x: 52, y: 75 },
  ],
];

const demoFish = [
  { text: "蘋果", x: 22, y: 38, colorIndex: 0 },
  { text: "學校", x: 72, y: 34, colorIndex: 1 },
  { text: "朋友", x: 35, y: 70, colorIndex: 2 },
  { text: "未來", x: 78, y: 72, colorIndex: 3 },
];

const bubbleSeeds = Array.from({ length: 10 }, (_, index) => ({
  id: `bubble-${index}`,
  size: 8 + (index % 4) * 4,
  x: 8 + index * 9,
  speed: 5 + (index % 5),
  delay: index * 0.4,
}));

const seaweedSeeds = [
  { left: 6, height: 52 },
  { left: 12, height: 68 },
  { left: 84, height: 58 },
  { left: 91, height: 72 },
];

const maxTime = 60;

function getGameId(prefix) {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}

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

function createQuestion(entries, priorityWordIds, pickQuestion) {
  const question = pickQuestion
    ? pickQuestion()
    : pickRandomEntry(entries, priorityWordIds);

  if (!question) {
    return null;
  }

  const wrongChoices = shuffleArray(
    entries.filter((item) => item.word !== question.word),
  ).slice(0, 3);
  const positions =
    fishLayouts[Math.floor(Math.random() * fishLayouts.length)] ?? fishLayouts[0];

  const choices = shuffleArray([question, ...wrongChoices]).map((item, index) => ({
    ...item,
    id: getGameId(`fish-${index}`),
    x: positions[index].x,
    y: positions[index].y,
    colorIndex: index % fishColors.length,
  }));

  return { question, choices };
}

const FishButton = forwardRef(function FishButton(
  { fish, disabled, onSelect, state = "" },
  ref,
) {
  const [colorA, colorB] = fishColors[fish.colorIndex % fishColors.length];

  return (
    <button
      ref={ref}
      className={["fishing-blast-fish", state].filter(Boolean).join(" ")}
      disabled={disabled}
      onClick={() => onSelect(fish.id)}
      style={{
        left: `${fish.x}%`,
        top: `${fish.y}%`,
        "--fish-a": colorA,
        "--fish-b": colorB,
      }}
      type="button"
    >
      <span className="fishing-blast-fish-tail" />
      <span className="fishing-blast-fish-body" />
      <span className="fishing-blast-fish-eye" />
      <span className="fishing-blast-fish-text">{fish.text ?? fish.meaning}</span>
    </button>
  );
});

function SceneDecorations() {
  return (
    <>
      {bubbleSeeds.map((bubble) => (
        <div
          className="fishing-blast-bubble"
          key={bubble.id}
          style={{
            "--bubble-delay": `${bubble.delay}s`,
            "--bubble-size": `${bubble.size}px`,
            "--bubble-speed": `${bubble.speed}s`,
            "--bubble-x": `${bubble.x}%`,
          }}
        />
      ))}
      {seaweedSeeds.map((weed, index) => (
        <div
          className="fishing-blast-seaweed"
          key={`weed-${weed.left}`}
          style={{
            animationDelay: `${index * 0.3}s`,
            height: `${weed.height}px`,
            left: `${weed.left}%`,
          }}
        />
      ))}
    </>
  );
}

function FishingBlastPage() {
  const { t } = useLocale();
  const { words } = useWordsContext();
  const { commitMistakes, lastCommittedTerms, recordWrong, resetTracker } =
    useGameMistakeTracker();
  const gameAreaRef = useRef(null);
  const fisherRef = useRef(null);
  const fishRefs = useRef({});

  const gameOptions = useMemo(() => ({ minWords: 4 }), []);
  const { beginPlaySession, defaultBank, getActivePlayBank, pickNextEntry } =
    useReviewSessionPlay(words, gameOptions);
  const {
    entries,
    isPriorityLimited,
    priorityCount,
    priorityWordIds,
    totalPriorityCount,
    usingFallback,
  } = defaultBank;

  const pickQuestionForBank = useCallback(
    (bank) =>
      shouldUseGamePlan(bank)
        ? () => pickNextEntry(bank)
        : () => pickRandomEntry(bank.entries, bank.priorityWordIds),
    [pickNextEntry],
  );

  const [gameState, setGameState] = useState("start");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(maxTime);
  const [round, setRound] = useState(1);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [reviewItems, setReviewItems] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState({ text: "", type: "" });
  const [fishStates, setFishStates] = useState({});
  const [fishingLine, setFishingLine] = useState(null);

  const startGame = useCallback(() => {
    resetTracker();
    const bank = beginPlaySession();
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimeLeft(maxTime);
    setRound(1);
    setStreak(0);
    setCorrectCount(0);
    setWrongCount(0);
    setReviewItems([]);
    setLocked(false);
    setStatus({ text: "", type: "" });
    setFishStates({});
    setFishingLine(null);
    setCurrentRound(
      createQuestion(bank.entries, bank.priorityWordIds, pickQuestionForBank(bank)),
    );
    setGameState("playing");
  }, [beginPlaySession, pickQuestionForBank, resetTracker]);

  const endGame = useCallback(() => {
    commitMistakes();
    setGameState("over");
    setLocked(true);
    setFishingLine(null);
  }, [commitMistakes]);

  const resetOptionState = useCallback(() => {
    setLocked(false);
    setFishStates({});
    setFishingLine(null);
  }, []);

  const nextQuestion = useCallback(() => {
    resetOptionState();
    setStatus({ text: "", type: "" });
    const bank = getActivePlayBank();
    setCurrentRound(
      createQuestion(bank.entries, bank.priorityWordIds, pickQuestionForBank(bank)),
    );
  }, [getActivePlayBank, pickQuestionForBank, resetOptionState]);

  const drawFishingLine = useCallback((fishId) => {
    const gameArea = gameAreaRef.current;
    const fishEl = fishRefs.current[fishId];
    const fisherEl = fisherRef.current;
    const rodEl = fisherEl?.querySelector(".fishing-blast-rod");

    if (!gameArea || !fishEl || !rodEl) return;

    const areaRect = gameArea.getBoundingClientRect();
    const fishRect = fishEl.getBoundingClientRect();
    const rodRect = rodEl.getBoundingClientRect();

    const startX = rodRect.left - areaRect.left;
    const startY = rodRect.top - areaRect.top + rodRect.height / 2;
    const targetX = fishRect.left - areaRect.left + fishRect.width / 2;
    const targetY = fishRect.top - areaRect.top + fishRect.height / 2;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angleDeg = (Math.atan2(dx, dy) * -180) / Math.PI;

    setFishingLine({ startX, startY, length, angleDeg });
  }, []);

  const chooseFish = useCallback(
    (fishId) => {
      if (locked || !currentRound) return;

      setLocked(true);
      drawFishingLine(fishId);

      const choice = currentRound.choices.find((item) => item.id === fishId);
      const isCorrect = choice?.word === currentRound.question.word;

      if (isCorrect) {
        setFishStates((current) => ({ ...current, [fishId]: "caught" }));
        setCombo((value) => {
          const nextCombo = value + 1;
          setBestCombo((best) => Math.max(best, nextCombo));
          setScore(
            (scoreValue) =>
              scoreValue +
              100 +
              nextCombo * 12 +
              Math.max(0, Math.floor(timeLeft / 5)),
          );
          return nextCombo;
        });
        setStreak((value) => value + 1);
        setCorrectCount((value) => value + 1);
        setStatus({ text: t("games.correct"), type: "good" });
        playTone(660, 0.08, "triangle", 0.04);
        window.setTimeout(() => playTone(900, 0.1, "triangle", 0.04), 90);
        window.setTimeout(() => {
          setRound((value) => value + 1);
          nextQuestion();
        }, 760);
        return;
      }

      setFishStates((current) => ({ ...current, [fishId]: "wrong" }));
      recordWrong(currentRound.question.word);
      setCombo(0);
      setStreak(0);
      setWrongCount((value) => value + 1);
      setTimeLeft((value) => Math.max(0, value - 5));
      setReviewItems((current) => {
        if (current.some((item) => item.word === currentRound.question.word)) {
          return current;
        }

        return [...current, currentRound.question];
      });
      setStatus({
        text: t("games.fishingBlast.wrong", { answer: currentRound.question.meaning }),
        type: "bad",
      });
      playTone(170, 0.16, "sawtooth", 0.035);

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
    [currentRound, drawFishingLine, endGame, locked, nextQuestion, recordWrong, t, timeLeft],
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

  const timerPercent = Math.max(0, (timeLeft / maxTime) * 100);
  const totalAttempts = correctCount + wrongCount;
  const accuracy =
    totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

  return (
    <section className="game-page-shell fishing-blast-app flex flex-col text-slate-50">
      <header className="game-page-header relative z-50 mb-1.5 flex shrink-0 items-center justify-between gap-2">
        <GameHomeButton fixed />
        {gameState === "start" ? (
          <div className="flex-1" aria-hidden="true" />
        ) : (
          <>
            <div className="pointer-events-none flex-1 text-center">
              <h1 className="font-black text-sky-100 drop-shadow">
                {t("games.fishingBlast.title")}
              </h1>
              <p className="text-sky-200">
                {t("games.fishingBlast.subtitle")}
              </p>
            </div>
            <div className="min-w-[4.5rem]" />
          </>
        )}
      </header>

      {gameState === "playing" ? (
        <>
          <div className="mb-1.5 grid grid-cols-5 gap-1.5">
            {[
              [t("games.score"), score, "text-yellow-300"],
              [t("games.combo"), combo, "text-green-300"],
              [t("games.time"), timeLeft, "text-amber-100"],
              [t("games.round"), round, "text-purple-200"],
              [t("games.streak"), streak, "text-sky-200"],
            ].map(([label, value, color]) => (
              <div className="fishing-blast-stat" key={label}>
                <p className="text-xs font-bold uppercase text-sky-200 sm:text-xs">
                  {label}
                </p>
                <p className={`text-sm font-black sm:text-xl ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full border border-sky-300/20 bg-sky-950/40">
            <div
              className="fishing-blast-timer-bar h-full rounded-full transition-all"
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

      <div className="fishing-blast-card relative z-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-1.5 sm:overflow-hidden sm:p-2">
        {gameState === "start" ? (
          <div className="fishing-blast-start-layout flex h-full min-h-0 flex-col text-center">
            <div className="fishing-blast-game-area relative min-h-0 flex-1" ref={gameAreaRef}>
              <div className="fishing-blast-sun" />
              <div className="fishing-blast-cloud" />
              <div className="fishing-blast-waterline" />
              <div className="fishing-blast-fisher" ref={fisherRef}>
                <div className="fishing-blast-person" />
                <div className="fishing-blast-rod" />
                <div className="fishing-blast-boat" />
              </div>
              <SceneDecorations />
              <div className="fishing-blast-prompt-panel">
                <p className="fishing-blast-prompt-label">{t("games.demoMode")}</p>
                <p className="fishing-blast-prompt-word">{t("games.fishingBlast.title")}</p>
                <p className="fishing-blast-prompt-type">{t("games.fishingBlast.fourFish")}</p>
              </div>
              <div className="fishing-blast-fish-zone">
                {demoFish.map((fish, index) => (
                  <FishButton
                    disabled
                    fish={{ ...fish, id: `demo-${index}` }}
                    key={fish.text}
                  />
                ))}
              </div>
              <div className="fishing-blast-sand" />
            </div>
            <div className="mt-2 shrink-0">
              <p className="text-sm text-sky-100">
                {t("games.fishingBlast.startHint")}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  className="fishing-blast-primary-btn"
                  onClick={startGame}
                  type="button"
                >
                  {t("games.startGame")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {gameState === "playing" && currentRound ? (
          <div
            className="fishing-blast-game-area relative h-full min-h-0"
            ref={gameAreaRef}
          >
            <div className="fishing-blast-sun" />
            <div className="fishing-blast-cloud" />
            <div className="fishing-blast-waterline" />
            <div className="fishing-blast-prompt-panel">
              <p className="fishing-blast-prompt-label">{t("games.fishingBlast.prompt")}</p>
              <GameWordWithSpeak
                as="p"
                className="fishing-blast-prompt-word"
                text={currentRound.question.word}
              />
              <p className="fishing-blast-prompt-type">
                {t("games.partOfSpeech", { type: currentRound.question.type })}
              </p>
              <p
                className={[
                  "fishing-blast-status",
                  status.type === "good" ? "good" : "",
                  status.type === "bad" ? "bad" : "",
                ].join(" ")}
              >
                {status.text}
              </p>
            </div>
            <div className="fishing-blast-fisher" ref={fisherRef}>
              <div className="fishing-blast-person" />
              <div className="fishing-blast-rod" />
              <div className="fishing-blast-boat" />
            </div>
            <SceneDecorations />
            {fishingLine ? (
              <div className="fishing-blast-line-layer">
                <div
                  className="fishing-blast-line"
                  style={{
                    "--angle": `${fishingLine.angleDeg}deg`,
                    "--line-length": `${fishingLine.length}px`,
                    "--start-x": `${fishingLine.startX}px`,
                    "--start-y": `${fishingLine.startY}px`,
                  }}
                >
                  <div className="fishing-blast-hook" />
                </div>
              </div>
            ) : null}
            <div className="fishing-blast-fish-zone" key={round}>
              {currentRound.choices.map((fish) => (
                <FishButton
                  disabled={locked}
                  fish={fish}
                  key={fish.id}
                  onSelect={chooseFish}
                  ref={(element) => {
                    fishRefs.current[fish.id] = element;
                  }}
                  state={fishStates[fish.id] ?? ""}
                />
              ))}
            </div>
            <div className="fishing-blast-sand" />
          </div>
        ) : null}

        {gameState === "over" ? (
          <div className="flex h-full flex-col overflow-y-auto text-center">
            <div className="fishing-blast-game-area relative min-h-[14rem] shrink-0">
              <div className="fishing-blast-sun" />
              <div className="fishing-blast-cloud" />
              <div className="fishing-blast-waterline" />
              <div className="fishing-blast-prompt-panel">
                <p className="fishing-blast-prompt-label">{t("games.gameOver")}</p>
                <p className="fishing-blast-prompt-word">{t("games.result")}</p>
                <p className="fishing-blast-status">
                  {t("games.fishingBlast.resultCount", { count: correctCount })}
                </p>
              </div>
              <div className="fishing-blast-fisher" ref={fisherRef}>
                <div className="fishing-blast-person" />
                <div className="fishing-blast-rod" />
                <div className="fishing-blast-boat" />
              </div>
              <SceneDecorations />
              <div className="fishing-blast-sand" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                [t("games.score"), score],
                [t("games.correct"), correctCount],
                [t("games.bestCombo"), bestCombo],
                [t("games.accuracy"), `${accuracy}%`],
              ].map(([label, value]) => (
                <div className="fishing-blast-summary-card" key={label}>
                  <p className="text-xs font-bold uppercase text-sky-200">
                    {label}
                  </p>
                  <p className="text-2xl font-black text-yellow-300">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-sky-300/20 bg-sky-950/30 p-3 text-left">
              <h3 className="font-black text-sky-100">{t("games.wordsToReview")}</h3>
              {reviewItems.length === 0 ? (
                <p className="mt-1 text-sm text-sky-200">{t("games.perfectNoMistakes")}</p>
              ) : (
                <ul className="mt-2 grid max-h-24 gap-1.5 overflow-y-auto">
                  {reviewItems.map((item) => (
                    <li
                      className="rounded-xl border border-sky-300/15 bg-sky-950/40 px-3 py-2 text-sm"
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
              <button
                className="fishing-blast-primary-btn"
                onClick={startGame}
                type="button"
              >
                {t("games.playAgain")}
              </button>
              <Link className="fishing-blast-secondary-btn" to="/">
                {t("common.home")}
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {gameState === "playing" ? null : (
        <GameWordBankStatus
          className="game-page-footer mt-1 block text-center text-xs text-sky-200"
          isPriorityLimited={isPriorityLimited}
          priorityCount={priorityCount}
          totalPriorityCount={totalPriorityCount}
          usingFallback={usingFallback}
          usingReviewSession={defaultBank.hasReviewSession && defaultBank.priorityCount > 0}
        />
      )}
    </section>
  );
}

export default FishingBlastPage;
