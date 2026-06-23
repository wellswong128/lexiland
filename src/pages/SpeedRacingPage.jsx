import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GameHomeButton from "../components/GameHomeButton.jsx";
import GameWordBankStatus from "../components/GameWordBankStatus.jsx";
import GameWordWithSpeak from "../components/GameWordWithSpeak.jsx";
import { buildTrueFalseTranslationQuestion } from "../features/games/gameWordBank.js";
import { useReviewSessionPlay } from "../features/games/useReviewSessionPlay.js";
import WordGroupScopeEmptyState from "../features/wordGroups/WordGroupScopeEmptyState.jsx";
import { useActiveGroupWordScope } from "../features/wordGroups/useActiveGroupWordScope.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useGameMistakeTracker } from "../features/review/useGameMistakeTracker.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { hasActiveReviewSession } from "../lib/reviewSessionStorage.js";
import speedRacingBgUrl from "../assets/speed-racing-bg.png";
import speedRacingCarUrl from "../assets/speed-racing-car.png";
import speedRacingQuestionPanelUrl from "../assets/speed-racing-question-panel.png";

const HIGH_SCORE_KEY = "lexiland.speedRacing.highScore.v1";
const ROUND_SECONDS = 5;
const COUNTDOWN_SECONDS = 5;

const LANE_LEFT = 0;
const LANE_CENTER = 1;
const LANE_RIGHT = 2;

const BG_LANE = {
  vanishY: 12,
  carY: 91,
  centerX: 50,
  roadLeftAtBottom: 0,
  roadRightAtBottom: 100,
};

const SCENE_CAR_Y = 92;
const SCENE_VANISH_Y = 14;

function getCoverMetrics(containerWidth, containerHeight, imageWidth, imageHeight) {
  const containerAR = containerWidth / containerHeight;
  const imageAR = imageWidth / imageHeight;

  if (containerAR > imageAR) {
    const renderWidth = containerWidth;
    const renderHeight = containerWidth / imageAR;
    return {
      renderWidth,
      renderHeight,
      offsetX: 0,
      offsetY: (containerHeight - renderHeight) / 2,
      imageWidth,
      imageHeight,
    };
  }

  const renderHeight = containerHeight;
  const renderWidth = containerHeight * imageAR;
  return {
    renderWidth,
    renderHeight,
    offsetX: (containerWidth - renderWidth) / 2,
    offsetY: 0,
    imageWidth,
    imageHeight,
  };
}

function sceneYToImageY(sceneYPercent, containerHeight, metrics) {
  const sceneY = (sceneYPercent / 100) * containerHeight;
  const imageY = ((sceneY - metrics.offsetY) / metrics.renderHeight) * metrics.imageHeight;
  return (imageY / metrics.imageHeight) * 100;
}

function imageXToSceneX(imageXPercent, containerWidth, metrics) {
  const imageX = (imageXPercent / 100) * metrics.imageWidth;
  const sceneX = metrics.offsetX + (imageX / metrics.imageWidth) * metrics.renderWidth;
  return (sceneX / containerWidth) * 100;
}

function getImageRoadEdgeX(edge, imageYPercent) {
  const progress = Math.max(
    0,
    Math.min(1, (imageYPercent - BG_LANE.vanishY) / (BG_LANE.carY - BG_LANE.vanishY)),
  );
  const xAtBottom = edge === "left" ? BG_LANE.roadLeftAtBottom : BG_LANE.roadRightAtBottom;
  return BG_LANE.centerX + (xAtBottom - BG_LANE.centerX) * progress;
}

function getLaneSceneX(lane, sceneYPercent, containerWidth, containerHeight, imageWidth, imageHeight) {
  if (lane === LANE_CENTER) {
    return 50;
  }

  const metrics = getCoverMetrics(containerWidth, containerHeight, imageWidth, imageHeight);
  const imageY = sceneYToImageY(sceneYPercent, containerHeight, metrics);
  const centerX = imageXToSceneX(BG_LANE.centerX, containerWidth, metrics);
  const edgeX = imageXToSceneX(
    getImageRoadEdgeX(lane === LANE_LEFT ? "left" : "right", imageY),
    containerWidth,
    metrics,
  );
  const visibleEdgeX = Math.max(0, Math.min(100, edgeX));

  return lane === LANE_LEFT
    ? (visibleEdgeX + centerX) / 2
    : (centerX + visibleEdgeX) / 2;
}

function getFallbackLaneX(lane) {
  if (lane === LANE_LEFT) return 25;
  if (lane === LANE_RIGHT) return 75;
  return 50;
}

function getCarLaneStyle(lane, bgSize, sceneSize) {
  if (!bgSize || !sceneSize?.width || !sceneSize?.height) {
    const x = getFallbackLaneX(lane);
    return {
      "--car-x": `${x}%`,
      "--lane-exit-drift": "0px",
    };
  }

  const x = getLaneSceneX(
    lane,
    SCENE_CAR_Y,
    sceneSize.width,
    sceneSize.height,
    bgSize.w,
    bgSize.h,
  );
  const exitX = getLaneSceneX(
    lane,
    SCENE_VANISH_Y,
    sceneSize.width,
    sceneSize.height,
    bgSize.w,
    bgSize.h,
  );

  return {
    "--car-x": `${x}%`,
    "--lane-exit-drift": `${((exitX - x) / 100) * sceneSize.width}px`,
  };
}

function loadHighScore() {
  try {
    return Number(window.localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score) {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // localStorage may be unavailable.
  }
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

function useSpeedRacingEngineSound(gamePhase, carPhase) {
  const audioCtxRef = useRef(null);
  const engineRef = useRef(null);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }

    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }
  }, []);

  const stopEngine = useCallback(() => {
    const engine = engineRef.current;
    const audioCtx = audioCtxRef.current;
    if (!engine || !audioCtx) {
      return;
    }

    engineRef.current = null;
    const now = audioCtx.currentTime;
    engine.masterGain.gain.cancelScheduledValues(now);
    engine.masterGain.gain.setValueAtTime(Math.max(engine.masterGain.gain.value, 0.0001), now);
    engine.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    window.setTimeout(() => {
      try {
        engine.noise.stop();
        engine.baseOsc.stop();
        engine.harmOsc.stop();
      } catch {
        // Nodes may already be stopped.
      }
    }, 240);
  }, []);

  const startEngine = useCallback(() => {
    initAudio();
    const audioCtx = audioCtxRef.current;
    if (!audioCtx || engineRef.current) {
      return;
    }

    const bufferSize = Math.floor(audioCtx.sampleRate * 2);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 280;
    noiseFilter.Q.value = 0.7;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.09;

    const baseOsc = audioCtx.createOscillator();
    baseOsc.type = "sawtooth";
    baseOsc.frequency.value = 68;

    const baseGain = audioCtx.createGain();
    baseGain.gain.value = 0.045;

    const harmOsc = audioCtx.createOscillator();
    harmOsc.type = "square";
    harmOsc.frequency.value = 136;

    const harmGain = audioCtx.createGain();
    harmGain.gain.value = 0.018;

    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.0001;

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    baseOsc.connect(baseGain);
    baseGain.connect(masterGain);
    harmOsc.connect(harmGain);
    harmGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    noise.start();
    baseOsc.start();
    harmOsc.start();

    engineRef.current = {
      baseOsc,
      harmOsc,
      masterGain,
      noiseFilter,
    };

    const now = audioCtx.currentTime;
    masterGain.gain.exponentialRampToValueAtTime(0.14, now + 0.35);
  }, [initAudio]);

  const setEngineMode = useCallback((mode) => {
    const engine = engineRef.current;
    const audioCtx = audioCtxRef.current;
    if (!engine || !audioCtx) {
      return;
    }

    const now = audioCtx.currentTime;
    const boost = mode === "boost";

    engine.baseOsc.frequency.cancelScheduledValues(now);
    engine.harmOsc.frequency.cancelScheduledValues(now);
    engine.noiseFilter.frequency.cancelScheduledValues(now);
    engine.masterGain.gain.cancelScheduledValues(now);

    engine.baseOsc.frequency.setValueAtTime(engine.baseOsc.frequency.value, now);
    engine.harmOsc.frequency.setValueAtTime(engine.harmOsc.frequency.value, now);
    engine.noiseFilter.frequency.setValueAtTime(engine.noiseFilter.frequency.value, now);
    engine.masterGain.gain.setValueAtTime(Math.max(engine.masterGain.gain.value, 0.0001), now);

    engine.baseOsc.frequency.exponentialRampToValueAtTime(boost ? 118 : 68, now + 0.28);
    engine.harmOsc.frequency.exponentialRampToValueAtTime(boost ? 236 : 136, now + 0.28);
    engine.noiseFilter.frequency.exponentialRampToValueAtTime(boost ? 520 : 280, now + 0.28);
    engine.masterGain.gain.exponentialRampToValueAtTime(boost ? 0.2 : 0.14, now + 0.18);
  }, []);

  useEffect(() => {
    if (gamePhase === "playing") {
      startEngine();
      return () => stopEngine();
    }

    stopEngine();
    return undefined;
  }, [gamePhase, startEngine, stopEngine]);

  useEffect(() => {
    if (gamePhase !== "playing") {
      return;
    }

    setEngineMode(carPhase === "exit" ? "boost" : "cruise");
  }, [carPhase, gamePhase, setEngineMode]);

  useEffect(() => () => stopEngine(), [stopEngine]);

  return { initAudio };
}

function createQuestion(bank, pickQuestion) {
  const item = pickQuestion?.() ?? null;

  if (!item || !bank?.entries?.length) {
    return null;
  }

  return buildTrueFalseTranslationQuestion(item, bank.entries);
}

function judgeAnswer(lane, question) {
  if (lane === LANE_CENTER) {
    return { isCorrect: false, noChoice: true };
  }

  const choseCorrect = lane === LANE_LEFT;
  const isCorrect = choseCorrect === question.isCorrectTranslation;

  return { isCorrect, noChoice: false };
}

function Building({ side, index }) {
  return (
    <div
      className={`speed-racing-building ${side}`}
      style={{
        "--building-h": `${48 + (index % 3) * 28}px`,
        "--building-delay": `${index * 0.35}s`,
        left: side === "left" ? `${4 + (index % 2) * 6}%` : undefined,
        right: side === "right" ? `${4 + (index % 2) * 6}%` : undefined,
      }}
    />
  );
}

function Car({ lane, phase = "idle", laneStyle }) {
  return (
    <div
      className={["speed-racing-car", phase].filter(Boolean).join(" ")}
      style={laneStyle}
    >
      <img alt="" className="speed-racing-car-image" src={speedRacingCarUrl} />
    </div>
  );
}

function SpeedRacingPage() {
  const { t } = useLocale();
  const { user, words } = useWordsContext();
  const { isLoadingScope, isGroupScopeActive, scopedWords } = useActiveGroupWordScope(words, user);
  const gameWords = isGroupScopeActive ? scopedWords : words;
  const { recordCorrect, recordWrong, resetTracker } = useGameMistakeTracker();

  const gameOptions = useMemo(() => ({ minWords: 4 }), []);
  const { beginPlaySession, defaultBank, getActivePlayBank, pickNextEntry } =
    useReviewSessionPlay(gameWords, gameOptions);
  const {
    isPriorityLimited,
    priorityCount,
    supplementedCount,
    totalMaintenanceCount,
    totalPriorityCount,
    usingFallback,
    usingMaintenanceMode,
  } = defaultBank;

  const pickQuestionForBank = useCallback(
    (bank) => () => pickNextEntry(bank),
    [pickNextEntry],
  );

  const [gamePhase, setGamePhase] = useState("rules");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(loadHighScore);
  const [round, setRound] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [carLane, setCarLane] = useState(LANE_CENTER);
  const [carPhase, setCarPhase] = useState("idle");
  const [feedback, setFeedback] = useState({ text: "", type: "" });
  const [borderFlash, setBorderFlash] = useState("");
  const [roundLocked, setRoundLocked] = useState(false);
  const [bgSize, setBgSize] = useState(null);
  const [sceneSize, setSceneSize] = useState(null);

  const resolveRef = useRef(null);
  const sceneRef = useRef(null);
  const { initAudio } = useSpeedRacingEngineSound(gamePhase, carPhase);

  const startCountdown = useCallback(() => {
    initAudio();
    resetTracker();
    beginPlaySession();
    setScore(0);
    setRound(1);
    setCountdown(COUNTDOWN_SECONDS);
    setGamePhase("countdown");
  }, [beginPlaySession, initAudio, resetTracker]);

  const loadNextQuestion = useCallback(() => {
    const bank = getActivePlayBank();
    const question = createQuestion(bank, pickQuestionForBank(bank));

    setCurrentQuestion(question);
    setCarLane(LANE_CENTER);
    setCarPhase("idle");
    setRoundTimeLeft(ROUND_SECONDS);
    setRoundLocked(false);
    setFeedback({ text: "", type: "" });
    setBorderFlash("");
    setGamePhase("playing");
  }, [getActivePlayBank, pickQuestionForBank]);

  const resolveRound = useCallback(() => {
    if (roundLocked || !currentQuestion) return;

    setRoundLocked(true);
    const { isCorrect, noChoice } = judgeAnswer(carLane, currentQuestion);

    if (noChoice) {
      setFeedback({ text: t("games.speedRacing.noChoice"), type: "neutral" });
      setBorderFlash("flash-neutral");
      playTone(220, 0.12, "sine", 0.03);
    } else if (isCorrect) {
      recordCorrect(currentQuestion.en);
      setScore((value) => {
        const next = value + 1;
        setHighScore((best) => {
          const updated = Math.max(best, next);
          saveHighScore(updated);
          return updated;
        });
        return next;
      });
      setFeedback({ text: t("games.speedRacing.youAreRight"), type: "good" });
      setBorderFlash("flash-good");
      playTone(660, 0.08, "triangle", 0.04);
      window.setTimeout(() => playTone(920, 0.1, "triangle", 0.04), 90);
    } else {
      recordWrong(currentQuestion.en);
      const answerHint = currentQuestion.isCorrectTranslation
        ? t("games.speedRacing.translationCorrect")
        : t("games.speedRacing.translationWrong");
      setFeedback({
        text: `${t("games.speedRacing.youAreWrong")} ${answerHint}`,
        type: "bad",
      });
      setBorderFlash("flash-bad");
      playTone(160, 0.16, "sawtooth", 0.035);
    }

    setCarPhase("exit");
    window.setTimeout(() => {
      setRound((value) => value + 1);
      loadNextQuestion();
    }, 1400);
  }, [carLane, currentQuestion, loadNextQuestion, recordCorrect, recordWrong, roundLocked, t]);

  resolveRef.current = resolveRound;

  const carLaneStyle = useMemo(
    () => getCarLaneStyle(carLane, bgSize, sceneSize),
    [bgSize, carLane, sceneSize],
  );

  useEffect(() => {
    const image = new Image();
    image.src = speedRacingBgUrl;
    image.onload = () => {
      setBgSize({ w: image.naturalWidth, h: image.naturalHeight });
    };
  }, []);

  useEffect(() => {
    const node = sceneRef.current;
    if (!node) return undefined;

    const updateSceneSize = () => {
      const { width, height } = node.getBoundingClientRect();
      setSceneSize({ width, height });
    };

    updateSceneSize();
    const observer = new ResizeObserver(updateSceneSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const moveCar = useCallback(
    (direction) => {
      if (roundLocked || gamePhase !== "playing") return;

      setCarLane((lane) => {
        if (direction === "left") {
          return Math.max(LANE_LEFT, lane - 1);
        }

        return Math.min(LANE_RIGHT, lane + 1);
      });
    },
    [gamePhase, roundLocked],
  );

  useEffect(() => {
    if (gamePhase !== "countdown") return undefined;

    if (countdown <= 0) {
      loadNextQuestion();
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setCountdown((value) => value - 1);
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [countdown, gamePhase, loadNextQuestion]);

  useEffect(() => {
    if (gamePhase !== "playing" || roundLocked) return undefined;

    if (roundTimeLeft <= 0) {
      resolveRef.current?.();
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setRoundTimeLeft((value) => value - 1);
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [gamePhase, roundLocked, roundTimeLeft]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (gamePhase !== "playing" || roundLocked) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveCar("left");
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveCar("right");
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [gamePhase, moveCar, roundLocked]);

  if (isLoadingScope) {
    return (
      <section className="w-full max-w-4xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-10">
        <p className="text-sm font-medium text-slate-600">{t("wordGroupsScope.loading")}</p>
      </section>
    );
  }

  if (isGroupScopeActive && (gameWords.length === 0 || usingFallback)) {
    return (
      <section className="w-full max-w-4xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
        <WordGroupScopeEmptyState compact />
      </section>
    );
  }

  const timerPercent = Math.max(0, (roundTimeLeft / ROUND_SECONDS) * 100);

  return (
    <section
      className={[
        "game-page-shell speed-racing-app flex flex-col",
        borderFlash,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="game-page-header relative z-50 mb-1.5 flex shrink-0 items-center justify-between gap-2">
        <GameHomeButton fixed />
        <div className="pointer-events-none flex-1 text-center">
          <h1 className="font-black text-orange-50 drop-shadow">{t("games.speedRacing.title")}</h1>
          <p className="text-sky-100">{t("games.speedRacing.subtitle")}</p>
        </div>
        <div className="min-w-[4.5rem]" />
      </header>

      <div className="speed-racing-card relative z-0 min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
        <div
          ref={sceneRef}
          className="speed-racing-scene relative h-full min-h-0"
          style={{
            "--speed-racing-bg": `url(${speedRacingBgUrl})`,
            "--speed-racing-question-bg": `url(${speedRacingQuestionPanelUrl})`,
          }}
        >
          <div className="speed-racing-scenery">
            {Array.from({ length: 6 }, (_, index) => (
              <Building index={index} key={`left-${index}`} side="left" />
            ))}
            {Array.from({ length: 6 }, (_, index) => (
              <Building index={index} key={`right-${index}`} side="right" />
            ))}
          </div>

          <div className="speed-racing-road">
            <div className="speed-racing-lane-mark left">
              <span className="speed-racing-lane-icon">✓</span>
            </div>
            <div className="speed-racing-center-line" />
            <div className="speed-racing-lane-mark right">
              <span className="speed-racing-lane-icon">✗</span>
            </div>
          </div>

          {gamePhase === "rules" ? (
            <div className="speed-racing-rules-modal">
              <div className="speed-racing-rules-box">
                <button
                  aria-label={t("games.speedRacing.closeRules")}
                  className="speed-racing-rules-close"
                  onClick={startCountdown}
                  type="button"
                >
                  ✕
                </button>
                <h2 className="speed-racing-rules-title">{t("games.speedRacing.rulesTitle")}</h2>
                <p className="speed-racing-rules-text">{t("games.speedRacing.rulesBody")}</p>
                <p className="speed-racing-rules-hint">{t("games.speedRacing.rulesHint")}</p>
              </div>
            </div>
          ) : null}

          {gamePhase === "countdown" ? (
            <div className="speed-racing-countdown-overlay">
              <p className="speed-racing-countdown-label">{t("games.speedRacing.getReady")}</p>
              <p className="speed-racing-countdown-number">{countdown || "GO!"}</p>
            </div>
          ) : null}

          {gamePhase === "playing" && currentQuestion ? (
            <>
              <div className="speed-racing-word-panel">
                <p className="speed-racing-word-label">{t("games.speedRacing.wordPrompt")}</p>
                <GameWordWithSpeak
                  as="p"
                  className="speed-racing-word-en"
                  text={currentQuestion.en}
                />
                <p className="speed-racing-word-zh">{currentQuestion.zh}</p>
                <p
                  className={[
                    "speed-racing-feedback",
                    feedback.type === "good" ? "good" : "",
                    feedback.type === "bad" ? "bad" : "",
                    feedback.type === "neutral" ? "neutral" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {feedback.text}
                </p>
              </div>

              <div className="speed-racing-timer-bar">
                <div className="speed-racing-timer-fill" style={{ width: `${timerPercent}%` }} />
              </div>

              <button
                aria-label={t("games.speedRacing.moveLeft")}
                className="speed-racing-arrow left"
                disabled={roundLocked}
                onClick={() => moveCar("left")}
                type="button"
              >
                ◀
              </button>
              <button
                aria-label={t("games.speedRacing.moveRight")}
                className="speed-racing-arrow right"
                disabled={roundLocked}
                onClick={() => moveCar("right")}
                type="button"
              >
                ▶
              </button>

              <div className="speed-racing-car-wrap">
                <Car lane={carLane} laneStyle={carLaneStyle} phase={carPhase} />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <footer className="speed-racing-footer relative z-10 mt-1.5 grid shrink-0 grid-cols-3 gap-2 text-center">
        <div className="speed-racing-stat">
          <p className="speed-racing-stat-label">{t("games.score")}</p>
          <p className="speed-racing-stat-value">{score}</p>
        </div>
        <div className="speed-racing-stat">
          <p className="speed-racing-stat-label">{t("games.round")}</p>
          <p className="speed-racing-stat-value">{Math.max(1, round - (gamePhase === "playing" ? 0 : 1))}</p>
        </div>
        <div className="speed-racing-stat">
          <p className="speed-racing-stat-label">{t("games.speedRacing.highScore")}</p>
          <p className="speed-racing-stat-value gold">{highScore}</p>
        </div>
      </footer>

      {gamePhase === "rules" ? (
        <GameWordBankStatus
          className="game-page-footer mt-1 block text-center text-xs text-sky-100"
          gameplayWordCount={defaultBank.questionEntries?.length ?? 0}
          isPriorityLimited={isPriorityLimited}
          priorityCount={priorityCount}
          supplementedCount={supplementedCount}
          totalMaintenanceCount={totalMaintenanceCount}
          totalPriorityCount={totalPriorityCount}
          usingFallback={usingFallback}
          usingMaintenanceMode={usingMaintenanceMode}
          usingReviewSession={hasActiveReviewSession() && defaultBank.priorityCount > 0}
        />
      ) : null}
    </section>
  );
}

export default SpeedRacingPage;
