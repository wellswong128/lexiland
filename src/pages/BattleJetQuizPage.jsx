import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GameHomeButton from "../components/GameHomeButton.jsx";
import GameMistakeSummary from "../components/GameMistakeSummary.jsx";
import GameWordBankStatus from "../components/GameWordBankStatus.jsx";
import GameWordWithSpeak from "../components/GameWordWithSpeak.jsx";
import {
  buildGameTranslationQuizQuestions,
  shouldUseGamePlan,
} from "../features/games/gameWordBank.js";
import { useReviewSessionPlay } from "../features/games/useReviewSessionPlay.js";
import { hasActiveReviewSession, loadReviewSession } from "../lib/reviewSessionStorage.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useGameMistakeTracker } from "../features/review/useGameMistakeTracker.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const TOTAL_ROUNDS = 10;

const JET_PATHS = [
  "fly-lr",
  "fly-rl",
  "fly-diagonal-up",
  "fly-diagonal-down",
  "fly-wave",
];

const JET_PART_CONFIG = [
  { type: "body", dx: -70, dy: -25, rot: "-180deg" },
  { type: "body", dx: 74, dy: 18, rot: "210deg" },
  { type: "wing", dx: -48, dy: 62, rot: "260deg" },
  { type: "wing", dx: 52, dy: -58, rot: "-240deg" },
  { type: "tail", dx: -86, dy: 30, rot: "300deg" },
  { type: "nose", dx: 94, dy: -18, rot: "190deg" },
  { type: "cockpit", dx: 16, dy: -78, rot: "-130deg" },
];

function useBattleJetAudio() {
  const audioCtxRef = useRef(null);
  const [soundMuted, setSoundMuted] = useState(false);

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

  const playNoiseBurst = useCallback((startTime, duration, volume, cutoff, endVolume) => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) {
      return;
    }

    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      const decay = 1 - index / bufferSize;
      data[index] = (Math.random() * 2 - 1) * decay;
    }

    const noise = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, cutoff * 0.35),
      startTime + duration,
    );

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(endVolume, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(startTime);
    noise.stop(startTime + duration);
  }, []);

  const playLaunchSound = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (soundMuted || !audioCtx) {
      return;
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.45);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.2);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.55);

    playNoiseBurst(now, 0.28, 0.09, 900, 0.0001);
  }, [playNoiseBurst, soundMuted]);

  const playExplosionSound = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (soundMuted || !audioCtx) {
      return;
    }

    const now = audioCtx.currentTime;
    playNoiseBurst(now, 0.82, 0.42, 420, 0.0001);

    const boom = audioCtx.createOscillator();
    const boomGain = audioCtx.createGain();
    const boomFilter = audioCtx.createBiquadFilter();

    boom.type = "sine";
    boom.frequency.setValueAtTime(95, now);
    boom.frequency.exponentialRampToValueAtTime(38, now + 0.55);
    boomFilter.type = "lowpass";
    boomFilter.frequency.setValueAtTime(360, now);
    boomGain.gain.setValueAtTime(0.0001, now);
    boomGain.gain.exponentialRampToValueAtTime(0.34, now + 0.025);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);

    boom.connect(boomFilter);
    boomFilter.connect(boomGain);
    boomGain.connect(audioCtx.destination);
    boom.start(now);
    boom.stop(now + 0.82);

    const crack = audioCtx.createOscillator();
    const crackGain = audioCtx.createGain();

    crack.type = "square";
    crack.frequency.setValueAtTime(140, now);
    crack.frequency.exponentialRampToValueAtTime(55, now + 0.16);
    crackGain.gain.setValueAtTime(0.0001, now);
    crackGain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    crack.connect(crackGain);
    crackGain.connect(audioCtx.destination);
    crack.start(now);
    crack.stop(now + 0.2);
  }, [playNoiseBurst, soundMuted]);

  const playTinyClickSound = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (soundMuted || !audioCtx) {
      return;
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }, [soundMuted]);

  const toggleSound = useCallback(() => {
    setSoundMuted((muted) => {
      const nextMuted = !muted;
      if (!nextMuted) {
        initAudio();
        playTinyClickSound();
      }
      return nextMuted;
    });
  }, [initAudio, playTinyClickSound]);

  return {
    initAudio,
    playExplosionSound,
    playLaunchSound,
    soundMuted,
    toggleSound,
  };
}

function BattleJetQuizPage() {
  const { t } = useLocale();
  const { words } = useWordsContext();
  const { commitMistakes, lastCommittedTerms, recordWrong, resetTracker } =
    useGameMistakeTracker();
  const {
    initAudio,
    playExplosionSound,
    playLaunchSound,
    soundMuted,
    toggleSound,
  } = useBattleJetAudio();

  const battlefieldRef = useRef(null);
  const jetRef = useRef(null);
  const missileRef = useRef(null);
  const timeoutIdsRef = useRef([]);
  const advanceAfterMessageRef = useRef(null);

  const gameOptions = useMemo(() => ({ minWords: 4 }), []);
  const { beginPlaySession, defaultBank } = useReviewSessionPlay(words, gameOptions);
  const session = loadReviewSession();
  const reviewSessionKey = `${session?.startedAt ?? "none"}:${session?.wordIds.length ?? 0}:${words.length}`;
  const cachedReviewQuestionsRef = useRef(null);
  const {
    entries,
    isPriorityLimited,
    priorityCount,
    priorityWordIds,
    totalPriorityCount,
    usingFallback,
  } = defaultBank;

  const [gameState, setGameState] = useState("start");
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [locked, setLocked] = useState(false);
  const [jetPath, setJetPath] = useState("fly-lr");
  const [jetReverse, setJetReverse] = useState(false);
  const [jetExploding, setJetExploding] = useState(false);
  const [jetPaused, setJetPaused] = useState(false);
  const [launcherFiring, setLauncherFiring] = useState(false);
  const [launchFlash, setLaunchFlash] = useState(false);
  const [smokeTrail, setSmokeTrail] = useState(false);
  const [missileVisible, setMissileVisible] = useState(false);
  const [missileStyle, setMissileStyle] = useState({});
  const [explosion, setExplosion] = useState(null);
  const [message, setMessage] = useState(null);
  const [optionStates, setOptionStates] = useState({});
  const [jetParts, setJetParts] = useState([]);
  const [debris, setDebris] = useState([]);
  const [finalResults, setFinalResults] = useState({
    hits: 0,
    rank: "",
    score: 0,
  });

  const currentQuestion = questions[currentIndex];

  const schedule = useCallback((callback, delay) => {
    const timeoutId = window.setTimeout(callback, delay);
    timeoutIdsRef.current.push(timeoutId);
    return timeoutId;
  }, []);

  const clearScheduled = useCallback(() => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current = [];
  }, []);

  useEffect(() => () => clearScheduled(), [clearScheduled]);

  useEffect(() => {
    cachedReviewQuestionsRef.current = null;
  }, [reviewSessionKey]);

  const resetOptionState = useCallback(() => {
    setLocked(false);
    setOptionStates({});
  }, []);

  const resetAnimation = useCallback(() => {
    advanceAfterMessageRef.current = null;
    setMessage(null);
    setJetExploding(false);
    setJetPaused(false);
    setMissileVisible(false);
    setMissileStyle({
      bottom: "118px",
      left: "50%",
      opacity: 0,
      top: "auto",
      transform: "translateX(-50%) rotate(0deg)",
      transition: "none",
    });
    setSmokeTrail(false);
    setExplosion(null);
    setLauncherFiring(false);
    setLaunchFlash(false);
    setJetParts([]);
    setDebris([]);
    resetOptionState();
  }, [resetOptionState]);

  const startRandomJet = useCallback(() => {
    const path = JET_PATHS[Math.floor(Math.random() * JET_PATHS.length)];
    setJetPath(path);
    setJetReverse(path === "fly-rl" || path === "fly-diagonal-down");
    setJetExploding(false);
    setJetPaused(false);
  }, []);

  const getJetCenter = useCallback(() => {
    const fieldRect = battlefieldRef.current?.getBoundingClientRect();
    const jetRect = jetRef.current?.getBoundingClientRect();

    if (!fieldRect || !jetRect) {
      return { x: fieldRect?.width ? fieldRect.width / 2 : 200, y: 120 };
    }

    return {
      x: jetRect.left - fieldRect.left + jetRect.width / 2,
      y: jetRect.top - fieldRect.top + jetRect.height / 2,
    };
  }, []);

  const calculateAngleToTarget = useCallback((targetX, targetY) => {
    const fieldRect = battlefieldRef.current?.getBoundingClientRect();
    if (!fieldRect) {
      return 0;
    }

    const startX = fieldRect.width / 2;
    const startY = fieldRect.height - 176 + 10;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const radians = Math.atan2(dy, dx);

    return (radians * 180) / Math.PI + 90;
  }, []);

  const burstJetIntoParts = useCallback((x, y) => {
    setJetParts(
      JET_PART_CONFIG.map((part, index) => ({
        ...part,
        id: `part-${index}-${Date.now()}`,
        x,
        y,
      })),
    );
    schedule(() => setJetParts([]), 720);
  }, [schedule]);

  const createDebris = useCallback((x, y) => {
    const pieces = Array.from({ length: 12 }, (_, index) => {
      const angle = ((Math.PI * 2) / 12) * index;
      const distance = 45 + Math.random() * 70;

      return {
        background:
          index % 3 === 0 ? "#ff8a00" : index % 3 === 1 ? "#333" : "#d82416",
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        id: `debris-${index}-${Date.now()}`,
        x,
        y,
      };
    });

    setDebris(pieces);
    schedule(() => setDebris([]), 850);
  }, [schedule]);

  const fireLauncher = useCallback(() => {
    setLauncherFiring(false);
    setLaunchFlash(false);
    setSmokeTrail(false);

    window.requestAnimationFrame(() => {
      setLauncherFiring(true);
      setLaunchFlash(true);
      setSmokeTrail(true);
    });
  }, []);

  const playHitAnimation = useCallback(() => {
    const target = getJetCenter();
    setJetPaused(true);

    setMissileVisible(true);
    setMissileStyle({
      bottom: "118px",
      left: "50%",
      opacity: 1,
      top: "auto",
      transform: "translateX(-50%) rotate(0deg)",
      transition:
        "left 0.95s cubic-bezier(.16,.78,.24,1), top 0.95s cubic-bezier(.16,.78,.24,1), bottom 0.95s cubic-bezier(.16,.78,.24,1), transform 0.95s cubic-bezier(.16,.78,.24,1), opacity 0.3s ease",
    });

    const angle = calculateAngleToTarget(target.x, target.y);

    schedule(() => {
      setMissileStyle((current) => ({
        ...current,
        bottom: "auto",
        left: `${target.x}px`,
        top: `${target.y}px`,
        transform: `translateX(-50%) rotate(${angle}deg)`,
      }));
    }, 40);

    schedule(() => {
      playExplosionSound();
      setExplosion({ x: target.x, y: target.y });
      burstJetIntoParts(target.x, target.y);
      setJetExploding(true);
      setMissileVisible(false);
      createDebris(target.x, target.y);

      schedule(() => {
        setJetExploding(false);
        setJetPaused(false);
        startRandomJet();
      }, 520);
    }, 920);
  }, [
    burstJetIntoParts,
    calculateAngleToTarget,
    createDebris,
    getJetCenter,
    playExplosionSound,
    schedule,
    startRandomJet,
  ]);

  const playMissAnimation = useCallback(() => {
    setMissileVisible(true);
    setMissileStyle({
      bottom: "118px",
      left: "50%",
      opacity: 1,
      top: "auto",
      transform: "translateX(-50%) rotate(0deg)",
      transition:
        "left 1s ease-in, top 1s ease-in, bottom 1s ease-in, transform 1s ease-in, opacity 0.4s ease",
    });

    schedule(() => {
      setMissileStyle((current) => ({
        ...current,
        bottom: "auto",
        left: "50%",
        top: "-90px",
        transform: "translateX(-50%) rotate(0deg)",
      }));
    }, 40);

    schedule(() => {
      setMissileVisible(false);
    }, 950);
  }, [schedule]);

  const loadQuestion = useCallback(
    (index) => {
      resetAnimation();
      startRandomJet();
      setCurrentIndex(index);
      resetOptionState();
    },
    [resetAnimation, resetOptionState, startRandomJet],
  );

  const startGame = useCallback(() => {
    clearScheduled();
    initAudio();
    resetTracker();

    const bank = beginPlaySession();
    const useGamePlan = shouldUseGamePlan(bank);
    const nextQuestions = useGamePlan
      ? (cachedReviewQuestionsRef.current ??=
          buildGameTranslationQuizQuestions(bank, TOTAL_ROUNDS))
      : buildGameTranslationQuizQuestions(bank, TOTAL_ROUNDS);

    if (!useGamePlan) {
      cachedReviewQuestionsRef.current = null;
    }

    if (useGamePlan && nextQuestions.length === 0) {
      return;
    }

    setQuestions(nextQuestions);
    setHits(0);
    setScore(0);
    setCombo(0);
    setGameState("playing");
    loadQuestion(0);
  }, [beginPlaySession, clearScheduled, initAudio, loadQuestion, resetTracker]);

  const getComboMessage = useCallback(
    (nextCombo) => {
      if (nextCombo === 2) {
        return t("games.battleJet.combo2");
      }
      if (nextCombo === 3) {
        return t("games.battleJet.combo3");
      }
      if (nextCombo >= 4 && nextCombo < 10) {
        return t("games.battleJet.comboN", { combo: nextCombo });
      }
      if (nextCombo === 10) {
        return t("games.battleJet.comboPerfect");
      }
      return "";
    },
    [t],
  );

  const getRank = useCallback(
    (hitCount) => {
      if (hitCount === 10) {
        return t("games.battleJet.rankLegend");
      }
      if (hitCount >= 8) {
        return t("games.battleJet.rankAce");
      }
      if (hitCount >= 6) {
        return t("games.battleJet.rankGood");
      }
      if (hitCount >= 4) {
        return t("games.battleJet.rankTrainee");
      }
      return t("games.battleJet.rankNeedTraining");
    },
    [t],
  );

  const endGame = useCallback(
    (finalHits, finalScore) => {
      commitMistakes();
      setFinalResults({ hits: finalHits, score: finalScore, rank: getRank(finalHits) });
      setGameState("end");
    },
    [commitMistakes, getRank],
  );

  const dismissMessage = useCallback(() => {
    const advance = advanceAfterMessageRef.current;
    if (!advance) {
      return;
    }

    advanceAfterMessageRef.current = null;
    setMessage(null);
    advance();
  }, []);

  const handleCorrect = useCallback(
    (choice, question) => {
      const nextCombo = combo + 1;
      let addScore = 100;

      if (nextCombo === 2) {
        addScore += 20;
      } else if (nextCombo === 3) {
        addScore += 50;
      } else if (nextCombo >= 4 && nextCombo < 10) {
        addScore += 80;
      } else if (nextCombo === 10) {
        addScore += 300;
      }

      const nextHits = hits + 1;
      const nextScore = score + addScore;

      setHits(nextHits);
      setScore(nextScore);
      setCombo(nextCombo);
      setOptionStates({ [choice]: "correct", selected: choice });
      setMessage({
        answer: t("games.battleJet.answerCorrect", {
          en: question.en,
          zh: question.zh,
        }),
        combo: getComboMessage(nextCombo),
        type: "hit",
      });

      advanceAfterMessageRef.current = () => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= TOTAL_ROUNDS) {
          endGame(nextHits, nextScore);
        } else {
          loadQuestion(nextIndex);
        }
      };
    },
    [combo, currentIndex, endGame, getComboMessage, hits, loadQuestion, score, t],
  );

  const handleWrong = useCallback(
    (choice, question) => {
      recordWrong(question.en);
      setCombo(0);
      setOptionStates({
        [choice]: "wrong",
        [question.zh]: "correct",
        selected: choice,
      });
      setMessage({
        answer: t("games.battleJet.answerWrong", {
          en: question.en,
          zh: question.zh,
        }),
        combo: "",
        type: "miss",
      });

      advanceAfterMessageRef.current = () => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= TOTAL_ROUNDS) {
          endGame(hits, score);
        } else {
          loadQuestion(nextIndex);
        }
      };
    },
    [currentIndex, endGame, hits, loadQuestion, recordWrong, score, t],
  );

  const chooseAnswer = useCallback(
    (choice) => {
      if (locked || !currentQuestion) {
        return;
      }

      setLocked(true);
      initAudio();

      const isCorrect = choice === currentQuestion.zh;
      setOptionStates({ selected: choice });

      fireLauncher();
      playLaunchSound();

      if (isCorrect) {
        playHitAnimation();
      } else {
        playMissAnimation();
      }

      schedule(() => {
        if (isCorrect) {
          handleCorrect(choice, currentQuestion);
        } else {
          handleWrong(choice, currentQuestion);
        }
      }, 1250);
    },
    [
      currentQuestion,
      fireLauncher,
      handleCorrect,
      handleWrong,
      initAudio,
      locked,
      playHitAnimation,
      playLaunchSound,
      playMissAnimation,
      schedule,
    ],
  );

  const isPlaying = gameState === "playing";

  return (
    <section
      className={[
        "game-page-shell battle-jet-app flex flex-col text-[#133047]",
        isPlaying ? "battle-jet-app--playing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="game-page-header relative z-50 mb-1.5 flex shrink-0 items-center justify-between gap-2">
        <GameHomeButton fixed variant="light" />
        {isPlaying ? null : (
          <div className="pointer-events-none flex-1 text-center">
            <h1 className="font-black text-[#0d62bd] drop-shadow">
              {t("games.battleJet.title")}
            </h1>
            <p className="font-bold text-[#198242]">
              {t("games.battleJet.subtitle")}
            </p>
          </div>
        )}
        {isPlaying ? null : <div className="min-w-[4.5rem]" />}
      </header>

      <div className="battle-jet-wrapper min-h-0 flex-1 overflow-hidden">
        {gameState === "start" ? (
          <div className="battle-jet-screen active">
            <div className="battle-jet-card">
              <h2 className="battle-jet-title">{t("games.battleJet.heroTitle")}</h2>
              <p className="battle-jet-subtitle">{t("games.battleJet.title")}</p>
              <div aria-hidden="true" className="battle-jet-intro-icon">
                ✈️🚀
              </div>
              <p className="battle-jet-note">{t("games.battleJet.introNote")}</p>
              <button className="battle-jet-btn" onClick={startGame} type="button">
                {t("games.battleJet.startMission")}
              </button>
            </div>
          </div>
        ) : null}

        {gameState === "playing" && currentQuestion ? (
          <div className="battle-jet-screen battle-jet-screen--playing active">
            <div className="battle-jet-layout battle-jet-layout--playing">
              <div className="battle-jet-top-bar">
                <span>
                  {t("games.battleJet.round", {
                    current: currentIndex + 1,
                    total: TOTAL_ROUNDS,
                  })}
                </span>
                <span>{t("games.battleJet.hits", { count: hits })}</span>
                <span>{t("games.battleJet.scoreLabel", { score })}</span>
                <button
                  className="battle-jet-sound-toggle"
                  onClick={toggleSound}
                  type="button"
                >
                  {soundMuted
                    ? t("games.battleJet.soundOff")
                    : t("games.battleJet.soundOn")}
                </button>
              </div>

              <div className="battle-jet-mission-panel">
                <div className="battle-jet-mission-label">
                  {t("games.battleJet.missionLabel")}
                </div>
                <GameWordWithSpeak
                  className="battle-jet-question-word"
                  text={currentQuestion.en}
                />
              </div>

              <div className="battle-jet-battlefield" ref={battlefieldRef}>
                <div className="battle-jet-sun" />
                <div className="battle-jet-cloud one" />
                <div className="battle-jet-cloud two" />
                <div className="battle-jet-cloud three" />
                <div className="battle-jet-mountains" />
                <div className="battle-jet-city" />
                <div className="battle-jet-ground" />
                <div className="battle-jet-radar" />

                <div
                  className={[
                    "battle-jet-jet",
                    jetPath,
                    jetReverse ? "reverse" : "",
                    jetExploding ? "exploding" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  ref={jetRef}
                  style={{ animationPlayState: jetPaused ? "paused" : "running" }}
                >
                  <div className="battle-jet-jet-flame" />
                  <div className="battle-jet-jet-tail" />
                  <div className="battle-jet-jet-wing" />
                  <div className="battle-jet-jet-body" />
                  <div className="battle-jet-jet-cockpit" />
                  <div className="battle-jet-jet-nose" />
                </div>

                <div
                  className="battle-jet-missile"
                  ref={missileRef}
                  style={{
                    opacity: missileVisible ? 1 : 0,
                    pointerEvents: "none",
                    ...missileStyle,
                  }}
                >
                  <div className="battle-jet-missile-head" />
                  <div className="battle-jet-missile-body" />
                  <div className="battle-jet-missile-fin left" />
                  <div className="battle-jet-missile-fin right" />
                  <div className="battle-jet-missile-fire" />
                </div>

                <div
                  className={["battle-jet-smoke-trail", smokeTrail ? "show" : ""]
                    .filter(Boolean)
                    .join(" ")}
                />

                {explosion ? (
                  <div
                    className="battle-jet-explosion show"
                    style={{ left: `${explosion.x}px`, top: `${explosion.y}px` }}
                  />
                ) : null}

                {jetParts.map((part) => (
                  <div
                    className={`battle-jet-jet-part ${part.type} show`}
                    key={part.id}
                    style={{
                      "--dx": `${part.dx}px`,
                      "--dy": `${part.dy}px`,
                      "--rot": part.rot,
                      left: `${part.x}px`,
                      top: `${part.y}px`,
                    }}
                  />
                ))}

                {debris.map((piece) => (
                  <div
                    className="battle-jet-debris show"
                    key={piece.id}
                    style={{
                      "--dx": `${piece.dx}px`,
                      "--dy": `${piece.dy}px`,
                      background: piece.background,
                      left: `${piece.x}px`,
                      top: `${piece.y}px`,
                    }}
                  />
                ))}

                <div className={["battle-jet-launcher", launcherFiring ? "fire" : ""].join(" ")}>
                  <div
                    className={["battle-jet-launch-flash", launchFlash ? "show" : ""]
                      .filter(Boolean)
                      .join(" ")}
                  />
                  <div className="battle-jet-launcher-tube" />
                  <div className="battle-jet-launcher-base" />
                  <div className="battle-jet-launcher-wheel left" />
                  <div className="battle-jet-launcher-wheel right" />
                </div>

                {message ? (
                  <button
                    className="battle-jet-message-layer"
                    onClick={dismissMessage}
                    type="button"
                  >
                    <div className="battle-jet-message show">
                      <div
                        className={[
                          "battle-jet-result-word",
                          message.type === "hit" ? "hit-text" : "miss-text",
                        ].join(" ")}
                      >
                        {message.type === "hit"
                          ? t("games.battleJet.hit")
                          : t("games.battleJet.miss")}
                      </div>
                      <div className="battle-jet-answer-text">{message.answer}</div>
                      {message.combo ? (
                        <div className="battle-jet-combo-text">{message.combo}</div>
                      ) : null}
                    </div>
                  </button>
                ) : null}
              </div>

              <div className="battle-jet-options-panel" key={currentIndex}>
                {currentQuestion.choices.map((choice, index) => {
                  const state = optionStates[choice] || "";
                  const isDisabled = locked || Boolean(optionStates.selected);

                  return (
                    <button
                      className={[
                        "battle-jet-option",
                        optionStates.selected === choice ? "selected" : "",
                        state,
                        isDisabled ? "disabled" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={isDisabled}
                      key={`${currentQuestion.en}-${choice}`}
                      onClick={() => chooseAnswer(choice)}
                      type="button"
                    >
                      {`${String.fromCharCode(65 + index)}. ${choice}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {gameState === "end" ? (
          <div className="battle-jet-screen active">
            <div className="battle-jet-card">
              <h2 className="battle-jet-title">{t("games.battleJet.missionComplete")}</h2>
              <p className="battle-jet-subtitle">{t("games.battleJet.yourRecord")}</p>
              <div className="battle-jet-end-score">
                {t("games.battleJet.finalScore", {
                  hits: finalResults.hits,
                  total: TOTAL_ROUNDS,
                })}
              </div>
              <p className="battle-jet-final-points">
                {t("games.battleJet.totalPoints", { score: finalResults.score })}
              </p>
              <p className="battle-jet-rank">{finalResults.rank}</p>
              <GameMistakeSummary className="mt-4 text-left" terms={lastCommittedTerms} />
              <button className="battle-jet-btn" onClick={startGame} type="button">
                {t("games.playAgain")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!isPlaying ? (
        <GameWordBankStatus
          className="game-page-footer mt-1 block shrink-0 text-center text-xs font-semibold text-[#4d6878] sm:text-xs"
          isPriorityLimited={isPriorityLimited}
          priorityCount={priorityCount}
          totalPriorityCount={totalPriorityCount}
          usingFallback={usingFallback}
          usingReviewSession={hasActiveReviewSession() && defaultBank.priorityCount > 0}
        />
      ) : null}
    </section>
  );
}

export default BattleJetQuizPage;
