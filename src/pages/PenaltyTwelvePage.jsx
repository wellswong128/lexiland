import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import GameHomeButton from "../components/GameHomeButton.jsx";
import GameMistakeSummary from "../components/GameMistakeSummary.jsx";
import GameWordBankStatus from "../components/GameWordBankStatus.jsx";
import GameWordWithSpeak from "../components/GameWordWithSpeak.jsx";
import {
  pickFixedRoundEntries,
  shuffleArray,
} from "../features/games/gameWordBank.js";
import { useReviewSessionPlay } from "../features/games/useReviewSessionPlay.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useGameMistakeTracker } from "../features/review/useGameMistakeTracker.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const TOTAL_ROUNDS = 10;

const GOAL_SHOTS = [
  {
    ballX: "31%",
    ballY: "144px",
    finalX: "30%",
    finalY: "134px",
    keeperDive: "right",
  },
  {
    ballX: "69%",
    ballY: "144px",
    finalX: "70%",
    finalY: "134px",
    keeperDive: "left",
  },
  {
    ballX: "34%",
    ballY: "240px",
    finalX: "33%",
    finalY: "232px",
    keeperDive: "right",
  },
  {
    ballX: "66%",
    ballY: "240px",
    finalX: "67%",
    finalY: "232px",
    keeperDive: "left",
  },
  {
    ballX: "52%",
    ballY: "188px",
    finalX: "52%",
    finalY: "178px",
    keeperDive: "left",
  },
];

const MISS_SHOTS = [
  "saved-left",
  "saved-right",
  "post-left",
  "post-right",
  "crossbar",
  "wide-left",
  "wide-right",
  "over",
];

const INITIAL_BALL_STYLE = {
  bottom: "42px",
  height: "",
  left: "50%",
  opacity: "1",
  top: "auto",
  transform: "translateX(-50%) rotate(0deg)",
  width: "",
};

const INITIAL_SHADOW_STYLE = {
  bottom: "28px",
  height: "",
  left: "50%",
  opacity: "1",
  top: "auto",
  width: "",
};

function makeChoicesForWord(entries, item) {
  const wrongPool = [
    ...new Set(
      entries
        .filter((candidate) => candidate.meaning !== item.meaning)
        .map((candidate) => candidate.meaning),
    ),
  ];

  return shuffleArray([item.meaning, ...shuffleArray(wrongPool).slice(0, 3)]);
}

function makeQuestions(entries, priorityWordIds, roundEntries) {
  const items =
    roundEntries ?? pickFixedRoundEntries(entries, priorityWordIds, TOTAL_ROUNDS);

  return items.map((item) => ({
    en: item.word,
    zh: item.meaning,
  }));
}

function usePenaltyTwelveAudio() {
  const audioCtxRef = useRef(null);
  const soundMutedRef = useRef(false);
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

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
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(endVolume, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(startTime);
    noise.stop(startTime + duration);
  }, []);

  const playKickSound = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (soundMutedRef.current || !audioCtx) {
      return;
    }

    const now = audioCtx.currentTime;
    playNoiseBurst(now, 0.12, 0.14, 520, 0.0001);

    const thump = audioCtx.createOscillator();
    const thumpGain = audioCtx.createGain();

    thump.type = "sine";
    thump.frequency.setValueAtTime(118, now);
    thump.frequency.exponentialRampToValueAtTime(52, now + 0.1);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.22, now + 0.012);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    thump.connect(thumpGain);
    thumpGain.connect(audioCtx.destination);
    thump.start(now);
    thump.stop(now + 0.15);

    const swoosh = audioCtx.createOscillator();
    const swooshGain = audioCtx.createGain();
    const swooshFilter = audioCtx.createBiquadFilter();

    swoosh.type = "triangle";
    swoosh.frequency.setValueAtTime(180, now + 0.03);
    swoosh.frequency.exponentialRampToValueAtTime(680, now + 0.22);
    swooshFilter.type = "highpass";
    swooshFilter.frequency.setValueAtTime(240, now + 0.03);
    swooshGain.gain.setValueAtTime(0.0001, now + 0.03);
    swooshGain.gain.exponentialRampToValueAtTime(0.08, now + 0.06);
    swooshGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    swoosh.connect(swooshFilter);
    swooshFilter.connect(swooshGain);
    swooshGain.connect(audioCtx.destination);
    swoosh.start(now + 0.03);
    swoosh.stop(now + 0.3);
  }, [playNoiseBurst]);

  const playGoalSound = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (soundMutedRef.current || !audioCtx) {
      return;
    }

    const now = audioCtx.currentTime;
    playNoiseBurst(now, 0.55, 0.18, 1800, 0.0001);
    playNoiseBurst(now + 0.08, 0.35, 0.1, 900, 0.0001);

    const cheer = audioCtx.createOscillator();
    const cheerGain = audioCtx.createGain();
    const cheerFilter = audioCtx.createBiquadFilter();

    cheer.type = "sawtooth";
    cheer.frequency.setValueAtTime(220, now);
    cheer.frequency.exponentialRampToValueAtTime(420, now + 0.4);
    cheerFilter.type = "bandpass";
    cheerFilter.frequency.setValueAtTime(360, now);
    cheerFilter.Q.setValueAtTime(0.7, now);
    cheerGain.gain.setValueAtTime(0.0001, now);
    cheerGain.gain.exponentialRampToValueAtTime(0.09, now + 0.05);
    cheerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

    cheer.connect(cheerFilter);
    cheerFilter.connect(cheerGain);
    cheerGain.connect(audioCtx.destination);
    cheer.start(now);
    cheer.stop(now + 0.65);

    const net = audioCtx.createOscillator();
    const netGain = audioCtx.createGain();

    net.type = "square";
    net.frequency.setValueAtTime(920, now + 0.02);
    net.frequency.exponentialRampToValueAtTime(240, now + 0.18);
    netGain.gain.setValueAtTime(0.0001, now + 0.02);
    netGain.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
    netGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    net.connect(netGain);
    netGain.connect(audioCtx.destination);
    net.start(now + 0.02);
    net.stop(now + 0.24);
  }, [playNoiseBurst]);

  const playSaveSound = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (soundMutedRef.current || !audioCtx) {
      return;
    }

    const now = audioCtx.currentTime;
    playNoiseBurst(now, 0.18, 0.12, 700, 0.0001);

    const pad = audioCtx.createOscillator();
    const padGain = audioCtx.createGain();

    pad.type = "triangle";
    pad.frequency.setValueAtTime(180, now);
    pad.frequency.exponentialRampToValueAtTime(95, now + 0.12);
    padGain.gain.setValueAtTime(0.0001, now);
    padGain.gain.exponentialRampToValueAtTime(0.14, now + 0.015);
    padGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    pad.connect(padGain);
    padGain.connect(audioCtx.destination);
    pad.start(now);
    pad.stop(now + 0.18);
  }, [playNoiseBurst]);

  const playPostSound = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (soundMutedRef.current || !audioCtx) {
      return;
    }

    const now = audioCtx.currentTime;
    const clang = audioCtx.createOscillator();
    const clangGain = audioCtx.createGain();

    clang.type = "square";
    clang.frequency.setValueAtTime(680, now);
    clang.frequency.exponentialRampToValueAtTime(220, now + 0.14);
    clangGain.gain.setValueAtTime(0.0001, now);
    clangGain.gain.exponentialRampToValueAtTime(0.11, now + 0.008);
    clangGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    clang.connect(clangGain);
    clangGain.connect(audioCtx.destination);
    clang.start(now);
    clang.stop(now + 0.22);

    playNoiseBurst(now, 0.14, 0.08, 1200, 0.0001);
  }, [playNoiseBurst]);

  const playWideSound = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (soundMutedRef.current || !audioCtx) {
      return;
    }

    const now = audioCtx.currentTime;
    const whoosh = audioCtx.createOscillator();
    const whooshGain = audioCtx.createGain();
    const whooshFilter = audioCtx.createBiquadFilter();

    whoosh.type = "sine";
    whoosh.frequency.setValueAtTime(420, now);
    whoosh.frequency.exponentialRampToValueAtTime(120, now + 0.45);
    whooshFilter.type = "highpass";
    whooshFilter.frequency.setValueAtTime(180, now);
    whooshGain.gain.setValueAtTime(0.0001, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
    whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(audioCtx.destination);
    whoosh.start(now);
    whoosh.stop(now + 0.52);
  }, []);

  const playTinyClickSound = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (soundMutedRef.current || !audioCtx) {
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
  }, []);

  const toggleSound = useCallback(() => {
    setSoundMuted((muted) => {
      const nextMuted = !muted;
      soundMutedRef.current = nextMuted;
      if (!nextMuted) {
        initAudio();
        window.setTimeout(() => {
          soundMutedRef.current = false;
          playTinyClickSound();
        }, 0);
      }
      return nextMuted;
    });
  }, [initAudio, playTinyClickSound]);

  return {
    initAudio,
    playGoalSound,
    playKickSound,
    playPostSound,
    playSaveSound,
    playWideSound,
    soundMuted,
    toggleSound,
  };
}

function PenaltyTwelvePage() {
  const { t } = useLocale();
  const { words } = useWordsContext();
  const { commitMistakes, lastCommittedTerms, recordWrong, resetTracker } =
    useGameMistakeTracker();
  const {
    initAudio,
    playGoalSound,
    playKickSound,
    playPostSound,
    playSaveSound,
    playWideSound,
    soundMuted,
    toggleSound,
  } = usePenaltyTwelveAudio();
  const timeoutIdsRef = useRef([]);
  const advanceAfterMessageRef = useRef(null);

  const gameOptions = useMemo(() => ({ minWords: 4 }), []);
  const { beginPlaySession, defaultBank, getActivePlayBank, pickRoundEntries } =
    useReviewSessionPlay(words, gameOptions);
  const {
    entries,
    isPriorityLimited,
    priorityCount,
    priorityWordIds,
    totalPriorityCount,
    usingFallback,
    usingReviewSession,
  } = defaultBank;

  const [gameState, setGameState] = useState("start");
  const [questions, setQuestions] = useState([]);
  const [currentChoices, setCurrentChoices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [goals, setGoals] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [locked, setLocked] = useState(false);
  const [optionStates, setOptionStates] = useState({});
  const [message, setMessage] = useState(null);
  const [finalResults, setFinalResults] = useState({ goals: 0, rank: "", score: 0 });

  const [ballPower, setBallPower] = useState(false);
  const [ballSecondMove, setBallSecondMove] = useState(false);
  const [ballStyle, setBallStyle] = useState(INITIAL_BALL_STYLE);
  const [shadowStyle, setShadowStyle] = useState(INITIAL_SHADOW_STYLE);
  const [keeperState, setKeeperState] = useState("");
  const [goalNetHit, setGoalNetHit] = useState(false);
  const [goalFrameShake, setGoalFrameShake] = useState(false);
  const [trailShow, setTrailShow] = useState(false);
  const [impact, setImpact] = useState(null);

  const currentQuestion = questions[currentIndex];
  const isPlaying = gameState === "playing";

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

  const moveBallTo = useCallback((left, top, width, height, rotateDeg, opacity) => {
    setBallStyle({
      bottom: "auto",
      height,
      left,
      opacity: String(opacity),
      top,
      transform: `translateX(-50%) rotate(${rotateDeg}deg)`,
      width,
    });
  }, []);

  const moveShadowTo = useCallback((left, top, width, height, opacity) => {
    setShadowStyle({
      bottom: "auto",
      height,
      left,
      opacity: String(opacity),
      top,
      width,
    });
  }, []);

  const showImpactAt = useCallback((left, top) => {
    setImpact({ left, show: true, top });
    schedule(() => setImpact(null), 360);
  }, [schedule]);

  const resetOptionState = useCallback(() => {
    setLocked(false);
    setOptionStates({});
  }, []);

  const resetAnimation = useCallback(() => {
    advanceAfterMessageRef.current = null;
    setMessage(null);
    setBallPower(false);
    setBallSecondMove(false);
    setBallStyle(INITIAL_BALL_STYLE);
    setShadowStyle(INITIAL_SHADOW_STYLE);
    setKeeperState("");
    setGoalNetHit(false);
    setGoalFrameShake(false);
    setTrailShow(false);
    setImpact(null);
    resetOptionState();
  }, [resetOptionState]);

  const loadQuestion = useCallback(
    (index, questionList = questions) => {
      resetAnimation();

      const question = questionList[index];
      if (question) {
        setCurrentChoices(
          makeChoicesForWord(getActivePlayBank().entries, {
            word: question.en,
            meaning: question.zh,
          }),
        );
      } else {
        setCurrentChoices([]);
      }

      setCurrentIndex(index);
      resetOptionState();
    },
    [getActivePlayBank, questions, resetAnimation, resetOptionState],
  );

  const getRank = useCallback(
    (goalCount) => {
      if (goalCount === 10) {
        return t("games.penaltyTwelve.rankLegend");
      }
      if (goalCount >= 8) {
        return t("games.penaltyTwelve.rankGolden");
      }
      if (goalCount >= 6) {
        return t("games.penaltyTwelve.rankStriker");
      }
      if (goalCount >= 4) {
        return t("games.penaltyTwelve.rankBench");
      }
      return t("games.penaltyTwelve.rankTrain");
    },
    [t],
  );

  const endGame = useCallback(
    (finalGoals, finalScore) => {
      commitMistakes();
      setFinalResults({
        goals: finalGoals,
        rank: getRank(finalGoals),
        score: finalScore,
      });
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

  const startGame = useCallback(() => {
    clearScheduled();
    initAudio();
    resetTracker();

    const bank = beginPlaySession();
    const roundEntries = bank.usingReviewSession
      ? pickRoundEntries(bank, TOTAL_ROUNDS)
      : null;
    const nextQuestions = makeQuestions(
      bank.entries,
      bank.priorityWordIds,
      roundEntries,
    );

    setQuestions(nextQuestions);
    setGoals(0);
    setScore(0);
    setCombo(0);
    setLocked(false);
    setGameState("playing");
    loadQuestion(0, nextQuestions);
  }, [
    beginPlaySession,
    clearScheduled,
    initAudio,
    loadQuestion,
    pickRoundEntries,
    resetTracker,
  ]);

  const getComboMessage = useCallback(
    (nextCombo) => {
      if (nextCombo === 2) {
        return t("games.penaltyTwelve.combo2");
      }
      if (nextCombo === 3) {
        return t("games.penaltyTwelve.combo3");
      }
      if (nextCombo >= 4 && nextCombo < 10) {
        return t("games.penaltyTwelve.comboN", { combo: nextCombo });
      }
      if (nextCombo === 10) {
        return t("games.penaltyTwelve.comboPerfect");
      }
      return "";
    },
    [t],
  );

  const getRandomMissLabel = useCallback(() => {
    const labels = [
      t("games.penaltyTwelve.missSaved"),
      t("games.penaltyTwelve.missPost"),
      t("games.penaltyTwelve.missCrossbar"),
      t("games.penaltyTwelve.missWide"),
      t("games.penaltyTwelve.missOver"),
    ];
    return labels[Math.floor(Math.random() * labels.length)];
  }, [t]);

  const playGoalAnimation = useCallback(() => {
    const shot = GOAL_SHOTS[Math.floor(Math.random() * GOAL_SHOTS.length)];
    setKeeperState(shot.keeperDive === "left" ? "dive-left" : "dive-right");
    moveBallTo(shot.ballX, shot.ballY, "22px", "22px", 950, 0.96);
    moveShadowTo(shot.ballX, "282px", "24px", "7px", 0.16);

    schedule(() => {
      playGoalSound();
      setBallSecondMove(true);
      setBallStyle({
        bottom: "auto",
        height: "18px",
        left: shot.finalX,
        opacity: "0.96",
        top: shot.finalY,
        transform: "translateX(-50%) rotate(1220deg)",
        width: "18px",
      });
      setGoalNetHit(true);
      setGoalFrameShake(true);
    }, 640);
  }, [moveBallTo, moveShadowTo, playGoalSound, schedule]);

  const playMissAnimation = useCallback(() => {
    const type = MISS_SHOTS[Math.floor(Math.random() * MISS_SHOTS.length)];

    if (type === "saved-left") {
      setKeeperState("dive-left");
      moveBallTo("30%", "184px", "23px", "23px", 980, 1);
      moveShadowTo("32%", "286px", "24px", "7px", 0.18);
      schedule(() => {
        playSaveSound();
        showImpactAt("30%", "184px");
        setBallSecondMove(true);
        setBallStyle({
          bottom: "auto",
          height: "24px",
          left: "16%",
          opacity: "1",
          top: "214px",
          transform: "translateX(-50%) rotate(1380deg)",
          width: "24px",
        });
      }, 640);
      return;
    }

    if (type === "saved-right") {
      setKeeperState("dive-right");
      moveBallTo("70%", "184px", "23px", "23px", 980, 1);
      moveShadowTo("68%", "286px", "24px", "7px", 0.18);
      schedule(() => {
        playSaveSound();
        showImpactAt("70%", "184px");
        setBallSecondMove(true);
        setBallStyle({
          bottom: "auto",
          height: "24px",
          left: "84%",
          opacity: "1",
          top: "214px",
          transform: "translateX(-50%) rotate(1380deg)",
          width: "24px",
        });
      }, 640);
      return;
    }

    if (type === "post-left") {
      setKeeperState("dive-right");
      moveBallTo("23%", "177px", "22px", "22px", 1080, 1);
      moveShadowTo("24%", "286px", "22px", "7px", 0.15);
      schedule(() => {
        playPostSound();
        showImpactAt("23%", "177px");
        setGoalFrameShake(true);
        setBallSecondMove(true);
        setBallStyle({
          bottom: "auto",
          height: "24px",
          left: "7%",
          opacity: "1",
          top: "222px",
          transform: "translateX(-50%) rotate(1420deg)",
          width: "24px",
        });
      }, 650);
      return;
    }

    if (type === "post-right") {
      setKeeperState("dive-left");
      moveBallTo("77%", "177px", "22px", "22px", 1080, 1);
      moveShadowTo("76%", "286px", "22px", "7px", 0.15);
      schedule(() => {
        playPostSound();
        showImpactAt("77%", "177px");
        setGoalFrameShake(true);
        setBallSecondMove(true);
        setBallStyle({
          bottom: "auto",
          height: "24px",
          left: "93%",
          opacity: "1",
          top: "222px",
          transform: "translateX(-50%) rotate(1420deg)",
          width: "24px",
        });
      }, 650);
      return;
    }

    if (type === "crossbar") {
      setKeeperState("dive-left");
      moveBallTo("50%", "126px", "21px", "21px", 1080, 1);
      moveShadowTo("50%", "280px", "20px", "6px", 0.13);
      schedule(() => {
        playPostSound();
        showImpactAt("50%", "126px");
        setGoalFrameShake(true);
        setBallSecondMove(true);
        setBallStyle({
          bottom: "auto",
          height: "19px",
          left: "54%",
          opacity: "0.75",
          top: "70px",
          transform: "translateX(-50%) rotate(1480deg)",
          width: "19px",
        });
        setShadowStyle({
          bottom: "auto",
          height: "6px",
          left: "50%",
          opacity: "0.03",
          top: "280px",
          width: "20px",
        });
      }, 650);
      return;
    }

    if (type === "wide-left") {
      setKeeperState("freeze");
      playWideSound();
      moveBallTo("-8%", "190px", "20px", "20px", 1180, 0.82);
      moveShadowTo("6%", "290px", "18px", "6px", 0.06);
      return;
    }

    if (type === "wide-right") {
      setKeeperState("freeze");
      playWideSound();
      moveBallTo("108%", "190px", "20px", "20px", 1180, 0.82);
      moveShadowTo("94%", "290px", "18px", "6px", 0.06);
      return;
    }

    setKeeperState("dive-right");
    playWideSound();
    moveBallTo("53%", "48px", "18px", "18px", 1160, 0.72);
    moveShadowTo("53%", "275px", "16px", "5px", 0.02);
  }, [
    moveBallTo,
    moveShadowTo,
    playPostSound,
    playSaveSound,
    playWideSound,
    schedule,
    showImpactAt,
  ]);

  const handleCorrect = useCallback(
    (choice, question) => {
      const nextCombo = combo + 1;
      let addScore = 100;

      if (nextCombo === 2) {
        addScore += 20;
      } else if (nextCombo === 3) {
        addScore += 50;
      } else if (nextCombo >= 4 && nextCombo < 10) {
        addScore += 70;
      } else if (nextCombo === 10) {
        addScore += 300;
      }

      const nextGoals = goals + 1;
      const nextScore = score + addScore;

      setGoals(nextGoals);
      setScore(nextScore);
      setCombo(nextCombo);
      setOptionStates({ [choice]: "correct", selected: choice });
      setMessage({
        answer: t("games.penaltyTwelve.answerCorrect", {
          en: question.en,
          zh: question.zh,
        }),
        combo: getComboMessage(nextCombo),
        type: "goal",
      });

      advanceAfterMessageRef.current = () => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= TOTAL_ROUNDS) {
          endGame(nextGoals, nextScore);
        } else {
          loadQuestion(nextIndex);
        }
      };
    },
    [
      combo,
      currentIndex,
      endGame,
      getComboMessage,
      goals,
      loadQuestion,
      score,
      t,
    ],
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
        answer: t("games.penaltyTwelve.answerWrong", {
          en: question.en,
          zh: question.zh,
        }),
        combo: "",
        missLabel: getRandomMissLabel(),
        type: "miss",
      });

      advanceAfterMessageRef.current = () => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= TOTAL_ROUNDS) {
          endGame(goals, score);
        } else {
          loadQuestion(nextIndex);
        }
      };
    },
    [
      currentIndex,
      endGame,
      getRandomMissLabel,
      goals,
      loadQuestion,
      recordWrong,
      score,
      t,
    ],
  );

  const chooseAnswer = useCallback(
    (choice) => {
      if (locked || !currentQuestion) {
        return;
      }

      setLocked(true);
      initAudio();
      playKickSound();
      setOptionStates({ selected: choice });
      setBallPower(true);

      schedule(() => {
        setTrailShow(true);
        if (choice === currentQuestion.zh) {
          playGoalAnimation();
        } else {
          playMissAnimation();
        }
      }, 180);

      schedule(() => {
        if (choice === currentQuestion.zh) {
          handleCorrect(choice, currentQuestion);
        } else {
          handleWrong(choice, currentQuestion);
        }
      }, 1180);
    },
    [
      currentQuestion,
      handleCorrect,
      handleWrong,
      initAudio,
      locked,
      playGoalAnimation,
      playKickSound,
      playMissAnimation,
      schedule,
    ],
  );

  return (
    <section
      className={[
        "game-page-shell penalty-twelve-app flex flex-col text-[#143047]",
        isPlaying ? "penalty-twelve-app--playing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="game-page-header relative z-50 mb-1.5 flex shrink-0 items-center justify-between gap-2">
        <GameHomeButton fixed variant="light" />
        {isPlaying ? null : (
          <div className="pointer-events-none flex-1 text-center">
            <h1 className="font-black text-[#0d62bd] drop-shadow">
              {t("games.penaltyTwelve.title")}
            </h1>
            <p className="font-bold text-[#13803d]">
              {t("games.penaltyTwelve.subtitle")}
            </p>
          </div>
        )}
        {isPlaying ? null : <div className="min-w-[4.5rem]" />}
      </header>

      <div className="penalty-twelve-wrapper min-h-0 flex-1 overflow-hidden">
        {gameState === "start" ? (
          <div className="penalty-twelve-screen active">
            <div className="penalty-twelve-card">
              <h2 className="penalty-twelve-title">{t("games.penaltyTwelve.heroTitle")}</h2>
              <p className="penalty-twelve-subtitle">{t("games.penaltyTwelve.subtitle")}</p>
              <div aria-hidden="true" className="penalty-twelve-intro-ball">
                ⚽
              </div>
              <p className="penalty-twelve-note">{t("games.penaltyTwelve.introNote")}</p>
              <button className="penalty-twelve-btn" onClick={startGame} type="button">
                {t("games.penaltyTwelve.startMatch")}
              </button>
            </div>
          </div>
        ) : null}

        {isPlaying && currentQuestion ? (
          <div className="penalty-twelve-screen penalty-twelve-screen--playing active">
            <div className="penalty-twelve-layout penalty-twelve-layout--playing">
              <div className="penalty-twelve-top-bar">
                <span>
                  {t("games.penaltyTwelve.round", {
                    current: currentIndex + 1,
                    total: TOTAL_ROUNDS,
                  })}
                </span>
                <span>{t("games.penaltyTwelve.goals", { count: goals })}</span>
                <span>{t("games.penaltyTwelve.scoreLabel", { score })}</span>
                <button
                  className="penalty-twelve-sound-toggle"
                  onClick={toggleSound}
                  type="button"
                >
                  {soundMuted
                    ? t("games.penaltyTwelve.soundOff")
                    : t("games.penaltyTwelve.soundOn")}
                </button>
              </div>

              <div className="penalty-twelve-word-panel">
                <div className="penalty-twelve-word-label">
                  {t("games.penaltyTwelve.missionLabel")}
                </div>
                <GameWordWithSpeak
                  className="penalty-twelve-english-word"
                  text={currentQuestion.en}
                />
              </div>

              <div className="penalty-twelve-stadium">
                <div className="penalty-twelve-cloud one" />
                <div className="penalty-twelve-cloud two" />
                <div className="penalty-twelve-stand" />

                <div className="penalty-twelve-pitch">
                  <div className="penalty-twelve-center-perspective-line" />
                  <div className="penalty-twelve-box-line" />
                </div>

                <div className="penalty-twelve-penalty-mark" />

                <div className="penalty-twelve-goal-wrap">
                  <div className="penalty-twelve-goal-depth" />
                  <div
                    className={[
                      "penalty-twelve-goal-net",
                      goalNetHit ? "net-hit" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                  <div
                    className={[
                      "penalty-twelve-goal-frame",
                      goalFrameShake ? "frame-shake" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                </div>

                <div
                  aria-label={t("games.penaltyTwelve.keeperLabel")}
                  className={["penalty-twelve-keeper", keeperState].filter(Boolean).join(" ")}
                >
                  <div className="penalty-twelve-keeper-head">
                    <div className="penalty-twelve-keeper-hair" />
                    <div className="penalty-twelve-keeper-face" />
                  </div>
                  <div className="penalty-twelve-keeper-body" />
                  <div className="penalty-twelve-keeper-arm left">
                    <div className="penalty-twelve-keeper-glove" />
                  </div>
                  <div className="penalty-twelve-keeper-arm right">
                    <div className="penalty-twelve-keeper-glove" />
                  </div>
                  <div className="penalty-twelve-keeper-leg left" />
                  <div className="penalty-twelve-keeper-leg right" />
                </div>

                <div className={["penalty-twelve-trail", trailShow ? "show" : ""].join(" ")} />

                <div className="penalty-twelve-ball-shadow" style={shadowStyle} />

                <div
                  className={[
                    "penalty-twelve-ball",
                    ballPower ? "power" : "",
                    ballSecondMove ? "second-move" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={ballStyle}
                />

                {impact?.show ? (
                  <div
                    className="penalty-twelve-impact show"
                    style={{ left: impact.left, top: impact.top }}
                  />
                ) : null}

                {message ? (
                  <button
                    className="penalty-twelve-message-layer"
                    onClick={dismissMessage}
                    type="button"
                  >
                    <div className="penalty-twelve-message show">
                      <div
                        className={[
                          "penalty-twelve-result-word",
                          message.type === "goal" ? "goal-text" : "miss-text",
                        ].join(" ")}
                      >
                        {message.type === "goal"
                          ? t("games.penaltyTwelve.goal")
                          : message.missLabel}
                      </div>
                      <div className="penalty-twelve-answer-text">{message.answer}</div>
                      {message.combo ? (
                        <div className="penalty-twelve-combo-text">{message.combo}</div>
                      ) : null}
                    </div>
                  </button>
                ) : null}
              </div>

              <div className="penalty-twelve-options-panel" key={currentIndex}>
                {currentChoices.map((choice, index) => {
                  const state = optionStates[choice] || "";
                  const isDisabled = locked || Boolean(optionStates.selected);

                  return (
                    <button
                      className={[
                        "penalty-twelve-option",
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
          <div className="penalty-twelve-screen active">
            <div className="penalty-twelve-card">
              <h2 className="penalty-twelve-title">{t("games.penaltyTwelve.matchOver")}</h2>
              <p className="penalty-twelve-subtitle">{t("games.penaltyTwelve.yourRecord")}</p>
              <div className="penalty-twelve-end-score">
                {t("games.penaltyTwelve.finalScore", {
                  goals: finalResults.goals,
                  total: TOTAL_ROUNDS,
                })}
              </div>
              <p className="penalty-twelve-final-points">
                {t("games.penaltyTwelve.totalPoints", { score: finalResults.score })}
              </p>
              <p className="penalty-twelve-rank">{finalResults.rank}</p>
              <GameMistakeSummary className="mt-4 text-left" terms={lastCommittedTerms} />
              <button className="penalty-twelve-btn" onClick={startGame} type="button">
                {t("games.playAgain")}
              </button>
              <Link className="penalty-twelve-secondary-btn" to="/">
                {t("common.home")}
              </Link>
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
          usingReviewSession={usingReviewSession}
        />
      ) : null}
    </section>
  );
}

export default PenaltyTwelvePage;
