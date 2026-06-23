import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import GameHomeButton from "../components/GameHomeButton.jsx";
import GameMistakeSummary from "../components/GameMistakeSummary.jsx";
import GameWordBankStatus from "../components/GameWordBankStatus.jsx";
import GameWordWithSpeak from "../components/GameWordWithSpeak.jsx";
import { speakText } from "../components/SpeakButton.jsx";
import {
  createMultipleChoiceQuestion,
  shuffleArray,
} from "../features/games/gameWordBank.js";
import { useReviewSessionPlay } from "../features/games/useReviewSessionPlay.js";
import WordGroupScopeEmptyState from "../features/wordGroups/WordGroupScopeEmptyState.jsx";
import { useActiveGroupWordScope } from "../features/wordGroups/useActiveGroupWordScope.js";
import { hasActiveReviewSession } from "../lib/reviewSessionStorage.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useGameMistakeTracker } from "../features/review/useGameMistakeTracker.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import deepSeaBackgroundUrl from "../assets/deep-sea-bg.png";
import smallFishUrl from "../assets/small-fish.png";
import orangeFishUrl from "../assets/orange-fish.png";
import dolphinFishUrl from "../assets/dolphin-fish.png";
import grouperFishUrl from "../assets/grouper-fish.png";
import anglerFishUrl from "../assets/angler-fish.png";
import harpoonUrl from "../assets/harpoon.png";

const GAME_SECONDS = 160;
const ROUND_DELAY_MS = 2000;
const FISH_PER_ROUND = 5;
const GROUPER_INTERVAL_MS = 30000;
const HOOK_FIRE_MS = 160;
const HOOK_RETRACT_MS = 320;
const SWING_SPEED = 1.8;
const MAX_SWING_ANGLE = Math.PI * 0.42;
const HOOK_MAX_LENGTH_RATIO = 0.78;
const HOOK_SWING_LENGTH_RATIO = 0.21;
const HARPOON_WIDTH_SCALE = 1.4;

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

const FISH_SPECIES = {
  small: {
    key: "small",
    points: 10,
    questions: 1,
    speedMin: 70,
    speedMax: 110,
    w: 72,
    h: 42,
    colors: ["#fdba74", "#fb923c"],
    weight: 40,
    spriteFacing: "right",
  },
  angler: {
    key: "angler",
    points: 20,
    questions: 2,
    speedMin: 60,
    speedMax: 95,
    w: 86,
    h: 52,
    colors: ["#c4b5fd", "#7c3aed"],
    lure: true,
    weight: 25,
    spriteFacing: "left",
  },
  dolphin: {
    key: "dolphin",
    points: 30,
    questions: 3,
    speedMin: 90,
    speedMax: 130,
    w: 96,
    h: 54,
    colors: ["#93c5fd", "#2563eb"],
    weight: 20,
    spriteFacing: "left",
  },
  shark: {
    key: "shark",
    points: 35,
    questions: 4,
    speedMin: 100,
    speedMax: 145,
    w: 110,
    h: 62,
    colors: ["#94a3b8", "#475569"],
    weight: 15,
    spriteFacing: "left",
  },
  grouper: {
    key: "grouper",
    points: 100,
    questions: 5,
    speedMin: 55,
    speedMax: 85,
    w: 126,
    h: 72,
    colors: ["#fde047", "#ca8a04"],
    boss: true,
    weight: 0,
    spriteFacing: "left",
  },
};

const BUBBLE_LAYOUT = [
  { x: 50, y: 28 },
  { x: 22, y: 48 },
  { x: 78, y: 48 },
  { x: 35, y: 68 },
  { x: 65, y: 68 },
];

let fishIdCounter = 0;

function nextFishId() {
  fishIdCounter += 1;
  return `fish-${fishIdCounter}`;
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

function pickRandomSpecies() {
  const pool = Object.values(FISH_SPECIES).filter((item) => !item.boss);
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const species of pool) {
    roll -= species.weight;
    if (roll <= 0) {
      return species;
    }
  }

  return pool[0];
}

function createFish(species, canvasWidth, canvasHeight, fromLeft) {
  const speed =
    species.speedMin + Math.random() * (species.speedMax - species.speedMin);
  const yMin = canvasHeight * 0.14;
  const yMax = canvasHeight * 0.72;
  const y = yMin + Math.random() * (yMax - yMin);
  const direction = fromLeft ? 1 : -1;
  const x = fromLeft ? -species.w - 10 : canvasWidth + species.w + 10;

  return {
    id: nextFishId(),
    species,
    x,
    y,
    vx: speed * direction,
    w: species.w,
    h: species.h,
    caught: false,
    wiggle: Math.random() * Math.PI * 2,
  };
}

function spawnRoundFish(canvasWidth, canvasHeight, count, includeGrouper = false) {
  const fishes = [];

  if (includeGrouper) {
    fishes.push(createFish(FISH_SPECIES.grouper, canvasWidth, canvasHeight, Math.random() > 0.5));
  }

  while (fishes.length < count) {
    const species = pickRandomSpecies();
    fishes.push(
      createFish(species, canvasWidth, canvasHeight, Math.random() > 0.5),
    );
  }

  return fishes;
}

function getHookTip(hook, originX, originY) {
  return {
    x: originX + Math.sin(hook.angle) * hook.length,
    y: originY - Math.cos(hook.angle) * hook.length,
  };
}

function hitTestFish(tipX, tipY, fish) {
  const centerX = fish.x + fish.w / 2;
  const centerY = fish.y + fish.h / 2;
  const hitRadius = Math.max(fish.w, fish.h) * 0.5 + 16;
  const dx = tipX - centerX;
  const dy = tipY - centerY;
  return dx * dx + dy * dy <= hitRadius * hitRadius;
}

function findFishAlongHook(originX, originY, angle, startLength, endLength, fishes) {
  const samples = 8;
  const from = Math.min(startLength, endLength);
  const to = Math.max(startLength, endLength);

  for (let step = 0; step <= samples; step += 1) {
    const length = from + ((to - from) * step) / samples;
    const tipX = originX + Math.sin(angle) * length;
    const tipY = originY - Math.cos(angle) * length;

    for (const fish of fishes) {
      if (!fish.caught && hitTestFish(tipX, tipY, fish)) {
        return fish;
      }
    }
  }

  return null;
}

function drawCoverImage(ctx, image, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawFish(ctx, fish, time, assets) {
  const { species, x, y, w, h, vx } = fish;
  const movingRight = vx > 0;
  const spriteFacesRight = species.spriteFacing !== "left";
  const shouldFlip =
    (spriteFacesRight && !movingRight) || (!spriteFacesRight && movingRight);
  const wiggle = Math.sin(time * 4 + fish.wiggle) * 3;
  const sprite = assets?.fish?.[species.key];

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + wiggle);
  if (shouldFlip) {
    ctx.scale(-1, 1);
  }

  if (sprite?.complete && sprite.naturalWidth) {
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  } else {
    const [colorA, colorB] = species.colors;
    const bodyGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    bodyGrad.addColorStop(0, colorA);
    bodyGrad.addColorStop(1, colorB);

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.38, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.lineTo(-w * 0.58, -h * 0.35);
    ctx.lineTo(-w * 0.58, h * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(w * 0.18, -h * 0.1, h * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(w * 0.2, -h * 0.1, h * 0.06, 0, Math.PI * 2);
    ctx.fill();

    if (species.lure) {
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h * 0.15);
      ctx.quadraticCurveTo(w * 0.5, h * 0.45, w * 0.35, h * 0.55);
      ctx.stroke();
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.58, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (species.boss) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 14px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("★", 0, -h * 0.55);
    }
  }

  ctx.restore();
}

function drawScene(ctx, width, height, state, time, assets) {
  const background = assets?.background;
  const hasBackground = background?.complete && background.naturalWidth;

  if (hasBackground) {
    drawCoverImage(ctx, background, width, height);
  } else {
    const waterGrad = ctx.createLinearGradient(0, 0, 0, height);
    waterGrad.addColorStop(0, "#083f7c");
    waterGrad.addColorStop(0.22, "#075985");
    waterGrad.addColorStop(0.58, "#07517c");
    waterGrad.addColorStop(1, "#031a3e");
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, width, height);
  }

  if (!hasBackground) {
    const surfaceGlow = ctx.createRadialGradient(width / 2, -height * 0.08, 0, width / 2, 0, width * 0.72);
    surfaceGlow.addColorStop(0, "rgba(217, 249, 255, 0.72)");
    surfaceGlow.addColorStop(0.24, "rgba(103, 232, 249, 0.26)");
    surfaceGlow.addColorStop(1, "rgba(103, 232, 249, 0)");
    ctx.fillStyle = surfaceGlow;
    ctx.fillRect(0, 0, width, height * 0.45);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const ray of [
      { x: width * 0.36, spread: width * 0.2, alpha: 0.12 },
      { x: width * 0.5, spread: width * 0.24, alpha: 0.16 },
      { x: width * 0.64, spread: width * 0.18, alpha: 0.1 },
    ]) {
      const rayGrad = ctx.createLinearGradient(ray.x, 0, ray.x, height * 0.78);
      rayGrad.addColorStop(0, `rgba(224, 242, 254, ${ray.alpha})`);
      rayGrad.addColorStop(1, "rgba(224, 242, 254, 0)");
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(ray.x - ray.spread * 0.18, 0);
      ctx.lineTo(ray.x + ray.spread * 0.18, 0);
      ctx.lineTo(ray.x + ray.spread, height * 0.78);
      ctx.lineTo(ray.x - ray.spread, height * 0.78);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.lineWidth = 1.8;
    for (let wave = 0; wave < 6; wave += 1) {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 7) {
        const y = 14 + wave * 5 + Math.sin(x * 0.024 + time * 2.2 + wave) * 3.5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  for (let i = 0; i < 70; i += 1) {
    const bx = (i * 73 + Math.sin(time * 0.45 + i) * 22) % width;
    const by = ((i * 47 - time * (18 + (i % 5) * 5)) % (height + 90)) - 50;
    const size = 1.4 + (i % 5) * 0.85;
    ctx.strokeStyle = `rgba(224, 242, 254, ${0.12 + (i % 4) * 0.045})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, size, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const fish of state.fishes) {
    if (!fish.caught) {
      drawFish(ctx, fish, time, assets);
    }
  }

  const originX = width / 2;
  const originY = height - 32;
  const hook = state.hook;
  const swingLength = hook.maxLength * HOOK_SWING_LENGTH_RATIO;
  const drawLength =
    hook.state === "swinging"
      ? swingLength
      : Math.max(hook.length, hook.state === "firing" ? 0 : swingLength * 0.35);
  const tip = getHookTip({ ...hook, length: drawLength }, originX, originY);

  ctx.save();
  ctx.strokeStyle = "rgba(224, 242, 254, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(originX, 34);
  ctx.lineTo(originX, originY - 6);
  ctx.stroke();
  ctx.restore();

  if (hook.state === "swinging") {
    ctx.strokeStyle = "rgba(254, 240, 138, 0.28)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(
      originX + Math.sin(hook.angle) * hook.maxLength,
      originY - Math.cos(hook.angle) * hook.maxLength,
    );
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (hook.launchFlash && hook.launchFlash > 0) {
    ctx.fillStyle = `rgba(253, 224, 71, ${hook.launchFlash})`;
    ctx.beginPath();
    ctx.arc(originX, originY, 16 + (1 - hook.launchFlash) * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  const harpoon = assets?.harpoon;
  if (harpoon?.complete && harpoon.naturalWidth) {
    const scale = drawLength / harpoon.naturalHeight;
    const drawW = harpoon.naturalWidth * scale * HARPOON_WIDTH_SCALE;
    ctx.save();
    ctx.translate(originX, originY);
    ctx.rotate(hook.angle);
    ctx.drawImage(harpoon, -drawW / 2, -drawLength, drawW, drawLength);
    ctx.restore();
  } else {
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 5;
    ctx.shadowColor = "rgba(253, 224, 71, 0.68)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const baseGrad = ctx.createLinearGradient(originX - 22, originY, originX + 22, originY);
    baseGrad.addColorStop(0, "#0f4c81");
    baseGrad.addColorStop(0.5, "#bae6fd");
    baseGrad.addColorStop(1, "#0f4c81");
    ctx.fillStyle = baseGrad;
    ctx.strokeStyle = "rgba(186, 230, 253, 0.7)";
    ctx.lineWidth = 1;
    ctx.fillRect(originX - 34, originY - 11, 68, 22);
    ctx.strokeRect(originX - 34, originY - 11, 68, 22);
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.arc(originX, originY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fde047";
    ctx.fillStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - 6, tip.y + 10);
    ctx.lineTo(tip.x + 6, tip.y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tip.x, tip.y + 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fef08a";
    ctx.fill();
  }

  if (hook.caughtFish) {
    drawFish(
      ctx,
      { ...hook.caughtFish, x: tip.x - hook.caughtFish.w / 2, y: tip.y - hook.caughtFish.h / 2 },
      time,
      assets,
    );
  }
}

function RulesPanel({ onClose, t }) {
  const rows = [
    { key: "small", art: "🐟" },
    { key: "angler", art: "🐠" },
    { key: "dolphin", art: "🐬" },
    { key: "shark", art: "🦈" },
    { key: "grouper", art: "👑" },
  ];

  return (
    <div className="dsf-rules-overlay">
      <div className="dsf-rules-card">
        <button className="dsf-rules-close" onClick={onClose} type="button" aria-label={t("games.deepSeaFishing.closeRules")}>
          ✕
        </button>
        <h2 className="dsf-rules-title">{t("games.deepSeaFishing.title")}</h2>
        <p className="dsf-rules-subtitle">{t("games.deepSeaFishing.rulesIntro")}</p>
        <table className="dsf-rules-table">
          <thead>
            <tr>
              <th>{t("games.deepSeaFishing.fishColumn")}</th>
              <th>{t("games.score")}</th>
              <th>{t("games.deepSeaFishing.questionsColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, art }) => (
              <tr key={key}>
                <td>
                  <span className="dsf-rules-fish-icon">{art}</span>
                  {t(`games.deepSeaFishing.fish.${key}`)}
                </td>
                <td>{FISH_SPECIES[key].points}</td>
                <td>{FISH_SPECIES[key].questions}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="dsf-rules-list">
          <li>{t("games.deepSeaFishing.ruleHook")}</li>
          <li>{t("games.deepSeaFishing.ruleQuiz")}</li>
          <li>{t("games.deepSeaFishing.rulePenalty")}</li>
          <li>{t("games.deepSeaFishing.ruleGrouper")}</li>
          <li>{t("games.deepSeaFishing.ruleTimer", { seconds: GAME_SECONDS })}</li>
        </ul>
        <p className="dsf-rules-hint">{t("games.deepSeaFishing.rulesHint")}</p>
      </div>
    </div>
  );
}

function QuizOverlay({
  quiz,
  questionIndex,
  totalQuestions,
  feedback,
  bubbleStates,
  locked,
  onPick,
  t,
}) {
  useEffect(() => {
    if (!quiz?.question?.word?.trim()) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      speakText(quiz.question.word);
    }, 120);

    return () => window.clearTimeout(timerId);
  }, [quiz?.question?.word, questionIndex]);

  if (!quiz) return null;

  const englishBubble = BUBBLE_LAYOUT[0];
  const choiceBubbles = BUBBLE_LAYOUT.slice(1, 1 + quiz.choices.length);

  return (
    <div className="dsf-quiz-overlay">
      <p className="dsf-quiz-progress">
        {t("games.deepSeaFishing.quizProgress", {
          current: questionIndex + 1,
          total: totalQuestions,
        })}
      </p>

      <div
        className={["dsf-bubble", "dsf-bubble-english", bubbleStates.english ?? ""].filter(Boolean).join(" ")}
        style={{ left: `${englishBubble.x}%`, top: `${englishBubble.y}%` }}
      >
        <GameWordWithSpeak
          as="span"
          autoSpeak={false}
          className="dsf-bubble-word"
          key={`${questionIndex}-${quiz.question.word}`}
          text={quiz.question.word}
        />
        <span className="dsf-bubble-label">{t("games.deepSeaFishing.englishWord")}</span>
      </div>

      {quiz.choices.map((choice, index) => {
        const layout = choiceBubbles[index] ?? choiceBubbles[choiceBubbles.length - 1];
        const state = bubbleStates[choice.word] ?? "";

        return (
          <button
            className={["dsf-bubble", "dsf-bubble-choice", state].filter(Boolean).join(" ")}
            disabled={locked}
            key={choice.word}
            onClick={() => onPick(choice.word)}
            style={{ left: `${layout.x}%`, top: `${layout.y}%` }}
            type="button"
          >
            <span className="dsf-bubble-word">{choice.meaning}</span>
          </button>
        );
      })}

      {feedback ? (
        <p className={["dsf-quiz-feedback", feedback.type].filter(Boolean).join(" ")}>
          {feedback.text}
        </p>
      ) : (
        <p className="dsf-quiz-prompt">{t("games.deepSeaFishing.quizPrompt")}</p>
      )}
    </div>
  );
}

function DeepSeaFishingPage() {
  const { t } = useLocale();
  const { user, words } = useWordsContext();
  const { isLoadingScope, isGroupScopeActive, scopedWords } = useActiveGroupWordScope(words, user);
  const gameWords = isGroupScopeActive ? scopedWords : words;
  const { commitMistakes, lastCommittedTerms, recordCorrect, recordWrong, resetTracker } =
    useGameMistakeTracker();

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

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(0);
  const gameRef = useRef(null);
  const lastFrameRef = useRef(0);
  const grouperDueRef = useRef(GROUPER_INTERVAL_MS);
  const imageAssetsRef = useRef(null);

  const [gameState, setGameState] = useState("rules");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [round, setRound] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [caughtCount, setCaughtCount] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [quizMeta, setQuizMeta] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [bubbleStates, setBubbleStates] = useState({});
  const [quizLocked, setQuizLocked] = useState(false);
  const [grouperAlert, setGrouperAlert] = useState(false);
  const [reviewItems, setReviewItems] = useState([]);
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    if (imageAssetsRef.current) return;

    const makeImage = (src) => {
      const image = new Image();
      image.src = src;
      return image;
    };

    const assets = {
      background: makeImage(deepSeaBackgroundUrl),
      harpoon: makeImage(harpoonUrl),
      fish: {
        small: makeImage(smallFishUrl),
        angler: makeImage(anglerFishUrl),
        dolphin: makeImage(dolphinFishUrl),
        shark: makeImage(orangeFishUrl),
        grouper: makeImage(grouperFishUrl),
      },
    };

    imageAssetsRef.current = assets;
    const allImages = [assets.background, assets.harpoon, ...Object.values(assets.fish)];
    let loaded = 0;
    const markLoaded = () => {
      loaded += 1;
      if (loaded >= allImages.length) {
        setAssetsReady((value) => !value);
      }
    };

    allImages.forEach((image) => {
      if (image.complete) {
        markLoaded();
      } else {
        image.onload = markLoaded;
        image.onerror = markLoaded;
      }
    });
  }, []);

  const initGameRef = useCallback(() => {
    const canvas = canvasRef.current;
    const width = canvas?.width ?? 800;
    const height = canvas?.height ?? 500;

    gameRef.current = {
      phase: "roundWait",
      roundWaitUntil: performance.now() + ROUND_DELAY_MS,
      fishes: [],
      hook: {
        angle: 0,
        fireAngle: 0,
        length: 0,
        maxLength: height * HOOK_MAX_LENGTH_RATIO,
        state: "swinging",
        caughtFish: null,
        fireStart: 0,
        retractStart: 0,
      },
      swingTime: 0,
      pendingGrouper: false,
      caughtFish: null,
      quizQuestions: [],
      quizIndex: 0,
      quizAllCorrect: true,
    };
    grouperDueRef.current = GROUPER_INTERVAL_MS;
    lastFrameRef.current = performance.now();
  }, []);

  const resizeCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    if (gameRef.current) {
      gameRef.current.hook.maxLength = rect.height * HOOK_MAX_LENGTH_RATIO;
    }
  }, []);

  const buildQuizQuestion = useCallback(() => {
    const bank = getActivePlayBank();
    const roundData = createMultipleChoiceQuestion(bank, pickQuestionForBank(bank));

    if (!roundData || roundData.choices.length < 2) {
      return null;
    }

    return {
      question: roundData.question,
      choices: shuffleArray(roundData.choices),
    };
  }, [getActivePlayBank, pickQuestionForBank]);

  const startQuizForFish = useCallback(
    (fish) => {
      const questions = [];
      const needed = fish.species.questions;

      for (let i = 0; i < needed; i += 1) {
        const q = buildQuizQuestion();
        if (q) questions.push(q);
      }

      if (questions.length === 0) {
        setGameState("playing");
        if (gameRef.current) {
          gameRef.current.phase = "playing";
          gameRef.current.hook.state = "swinging";
          gameRef.current.hook.length = 0;
          gameRef.current.hook.caughtFish = null;
        }
        return;
      }

      setQuiz(questions[0]);
      setQuizMeta({ fish, questions, allCorrect: true });
      setQuestionIndex(0);
      setQuizFeedback(null);
      setBubbleStates({});
      setQuizLocked(false);
      setGameState("quiz");

      if (gameRef.current) {
        gameRef.current.phase = "quiz";
        gameRef.current.quizQuestions = questions;
        gameRef.current.quizIndex = 0;
        gameRef.current.quizAllCorrect = true;
        gameRef.current.caughtFish = fish;
      }
    },
    [buildQuizQuestion],
  );

  const finishQuiz = useCallback(
    (allCorrect, fish) => {
      if (allCorrect) {
        setScore((value) => value + fish.species.points);
        setCaughtCount((value) => value + 1);
        playTone(660, 0.08, "triangle", 0.04);
        window.setTimeout(() => playTone(900, 0.1, "triangle", 0.04), 90);
      } else {
        playTone(170, 0.16, "sawtooth", 0.035);
      }

      setQuiz(null);
      setQuizMeta(null);
      setQuizFeedback(null);
      setBubbleStates({});
      setGameState("playing");
      setStatusText(allCorrect ? t("games.deepSeaFishing.catchSuccess", { points: fish.species.points }) : t("games.deepSeaFishing.catchFailed"));

      if (gameRef.current) {
        gameRef.current.phase = "playing";
        gameRef.current.hook.state = "swinging";
        gameRef.current.hook.length = 0;
        gameRef.current.hook.caughtFish = null;
        gameRef.current.caughtFish = null;
      }

      window.setTimeout(() => setStatusText(""), 1800);
    },
    [t],
  );

  const handleQuizPick = useCallback(
    (pickedWord) => {
      if (quizLocked || !quiz || !quizMeta) return;

      setQuizLocked(true);
      const isCorrect = pickedWord === quiz.question.word;
      const correctChoice = quiz.choices.find((item) => item.word === quiz.question.word);

      if (isCorrect) {
        recordCorrect(quiz.question.word);
        setQuizFeedback({ text: t("games.deepSeaFishing.youAreRight"), type: "good" });
        playTone(520, 0.07, "triangle", 0.04);

        const nextStates = { english: "stay" };
        quiz.choices.forEach((choice) => {
          nextStates[choice.word] = choice.word === pickedWord ? "stay" : "pop";
        });
        setBubbleStates(nextStates);

        window.setTimeout(() => {
          const nextIndex = questionIndex + 1;

          if (nextIndex >= quizMeta.questions.length) {
            finishQuiz(quizMeta.allCorrect, quizMeta.fish);
            return;
          }

          setQuestionIndex(nextIndex);
          setQuiz(quizMeta.questions[nextIndex]);
          setQuizFeedback(null);
          setBubbleStates({});
          setQuizLocked(false);

          if (gameRef.current) {
            gameRef.current.quizIndex = nextIndex;
          }
        }, 900);
        return;
      }

      recordWrong(quiz.question.word);
      setQuizMeta((current) => (current ? { ...current, allCorrect: false } : current));
      if (gameRef.current) {
        gameRef.current.quizAllCorrect = false;
      }

      setReviewItems((current) => {
        if (current.some((item) => item.word === quiz.question.word)) {
          return current;
        }
        return [...current, quiz.question];
      });

      setQuizFeedback({
        text: t("games.deepSeaFishing.youAreWrong", { answer: correctChoice?.meaning ?? "" }),
        type: "bad",
      });
      playTone(170, 0.16, "sawtooth", 0.035);

      const popStates = { english: "pop" };
      quiz.choices.forEach((choice) => {
        popStates[choice.word] = "pop";
      });
      setBubbleStates(popStates);

      window.setTimeout(() => {
        finishQuiz(false, quizMeta.fish);
      }, 1100);
    },
    [finishQuiz, questionIndex, quiz, quizLocked, quizMeta, recordCorrect, recordWrong, t],
  );

  const fireHook = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.phase !== "playing" || game.hook.state !== "swinging") {
      return;
    }

    game.hook.state = "firing";
    game.hook.fireAngle = game.hook.angle;
    game.hook.fireStart = performance.now();
    game.hook.length = 0;
    game.hook.prevLength = 0;
    game.hook.launchFlash = 1;
    playTone(280, 0.05, "square", 0.025);
    window.setTimeout(() => playTone(420, 0.04, "triangle", 0.03), 40);
  }, []);

  const startRound = useCallback((includeGrouper = false) => {
    const game = gameRef.current;
    const canvas = canvasRef.current;
    if (!game || !canvas) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    game.fishes = spawnRoundFish(width, height, FISH_PER_ROUND, includeGrouper);
    game.phase = "playing";
    setRound((value) => value + 1);

    if (includeGrouper) {
      setGrouperAlert(true);
      window.setTimeout(() => setGrouperAlert(false), 2500);
    }
  }, []);

  const endGame = useCallback(() => {
    commitMistakes();
    setGameState("over");
    if (gameRef.current) {
      gameRef.current.phase = "over";
    }
    cancelAnimationFrame(rafRef.current);
  }, [commitMistakes]);

  const startGame = useCallback(() => {
    resetTracker();
    beginPlaySession();
    setScore(0);
    setTimeLeft(GAME_SECONDS);
    setRound(0);
    setCaughtCount(0);
    setReviewItems([]);
    setStatusText("");
    setQuiz(null);
    setQuizMeta(null);
    setGrouperAlert(false);
    initGameRef();
    resizeCanvas();
    setGameState("playing");
  }, [beginPlaySession, initGameRef, resetTracker, resizeCanvas]);

  const gameLoop = useCallback(
    (now) => {
      const game = gameRef.current;
      const canvas = canvasRef.current;
      if (!game || !canvas || gameState === "over" || gameState === "rules") {
        return;
      }

      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = now;
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const originX = width / 2;
      const originY = height - 32;

      if (gameState === "playing") {
        if (!game.lastGrouperTick) {
          game.lastGrouperTick = now;
        }
        const grouperDelta = now - game.lastGrouperTick;
        game.lastGrouperTick = now;
        grouperDueRef.current -= grouperDelta;

        if (grouperDueRef.current <= 0) {
          grouperDueRef.current = GROUPER_INTERVAL_MS;
          game.pendingGrouper = true;
        }

        if (game.phase === "roundWait") {
          if (now >= game.roundWaitUntil) {
            startRound(game.pendingGrouper);
            game.pendingGrouper = false;
          }
        }

        game.swingTime += dt;
        if (game.hook.state === "swinging") {
          game.hook.angle = Math.sin(game.swingTime * SWING_SPEED) * MAX_SWING_ANGLE;
        }

        if (game.phase === "playing") {
          for (const fish of game.fishes) {
            if (!fish.caught) {
              fish.x += fish.vx * dt;
            }
          }

          game.fishes = game.fishes.filter(
            (fish) => fish.x > -fish.w - 40 && fish.x < width + fish.w + 40,
          );

          if (game.fishes.length === 0) {
            game.phase = "roundWait";
            game.roundWaitUntil = now + ROUND_DELAY_MS;
          }
        }

        if (game.hook.state === "firing") {
          const rawProgress = Math.min(1, (now - game.hook.fireStart) / HOOK_FIRE_MS);
          const progress = easeOutCubic(rawProgress);
          const prevLength = game.hook.prevLength ?? 0;
          game.hook.length = game.hook.maxLength * progress;
          game.hook.angle = game.hook.fireAngle;
          game.hook.launchFlash = Math.max(0, 1 - rawProgress * 4);

          const hitFish = findFishAlongHook(
            originX,
            originY,
            game.hook.fireAngle,
            prevLength,
            game.hook.length,
            game.fishes,
          );
          game.hook.prevLength = game.hook.length;

          if (hitFish || rawProgress >= 1) {
            game.hook.state = "retracting";
            game.hook.retractStart = now;
            game.hook.launchFlash = 0;

            if (hitFish) {
              hitFish.caught = true;
              game.hook.caughtFish = { ...hitFish };
              game.fishes = game.fishes.filter((fish) => fish.id !== hitFish.id);
            }
          }
        }

        if (game.hook.state === "retracting") {
          const progress = Math.min(1, (now - game.hook.retractStart) / HOOK_RETRACT_MS);
          game.hook.length = game.hook.maxLength * (1 - easeOutCubic(progress));
          game.hook.angle = game.hook.fireAngle;

          if (progress >= 1) {
            game.hook.length = 0;
            if (game.hook.caughtFish) {
              const caught = game.hook.caughtFish;
              game.hook.caughtFish = null;
              game.hook.state = "swinging";
              game.phase = "quiz";
              startQuizForFish(caught);
            } else {
              game.hook.state = "swinging";
            }
          }
        }
      }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawScene(ctx, width, height, game, now / 1000, imageAssetsRef.current);
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    },
    [gameState, startQuizForFish, startRound],
  );

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    if (gameState !== "rules") return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    drawScene(
      ctx,
      width,
      height,
      {
        fishes: [],
        hook: {
          angle: 0,
          length: 0,
          maxLength: height * HOOK_MAX_LENGTH_RATIO,
          state: "swinging",
          caughtFish: null,
        },
      },
      performance.now() / 1000,
      imageAssetsRef.current,
    );
  }, [assetsReady, gameState, resizeCanvas]);

  useEffect(() => {
    if (gameState === "playing" || gameState === "quiz") {
      lastFrameRef.current = performance.now();
      rafRef.current = requestAnimationFrame(gameLoop);
      return () => cancelAnimationFrame(rafRef.current);
    }
    return undefined;
  }, [gameLoop, gameState]);

  useEffect(() => {
    if (gameState !== "playing" && gameState !== "quiz") return undefined;

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
  }, [endGame, gameState]);

  const handleCanvasClick = useCallback(() => {
    if (gameState === "playing") {
      fireHook();
    }
  }, [fireHook, gameState]);

  const closeRules = useCallback(() => {
    startGame();
  }, [startGame]);

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

  const timerPercent = Math.max(0, (timeLeft / GAME_SECONDS) * 100);

  return (
    <section className="game-page-shell dsf-app flex flex-col text-slate-50">
      <header className="game-page-header dsf-header relative z-50 flex shrink-0 items-center justify-between gap-2">
        <GameHomeButton fixed />
        <div className="pointer-events-none flex-1 text-center">
          <h1 className="font-black text-sky-100 drop-shadow">
            {t("games.deepSeaFishing.title")}
          </h1>
          <p className="text-sky-200">{t("games.deepSeaFishing.subtitle")}</p>
        </div>
        <div className="min-w-[4.5rem]" />
      </header>

      {gameState !== "rules" && gameState !== "over" ? (
        <>
          <div className="dsf-stats-row grid grid-cols-3 gap-2">
            {[
              [t("games.score"), score, "text-yellow-300"],
              [t("games.time"), timeLeft, "text-amber-100"],
              [t("games.round"), round, "text-purple-200"],
            ].map(([label, value, color]) => (
              <div className="dsf-stat" key={label}>
                <p className="text-xs font-bold uppercase text-sky-200">{label}</p>
                <p className={`text-sm font-black sm:text-xl ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="dsf-timer-track h-2 overflow-hidden rounded-full">
            <div
              className="dsf-timer-bar h-full rounded-full transition-all"
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

      <div className="dsf-card relative z-0 min-h-0 flex-1 overflow-hidden">
        <div className="dsf-stage" ref={containerRef}>
          <canvas
            className="dsf-canvas"
            onClick={handleCanvasClick}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                handleCanvasClick();
              }
            }}
            ref={canvasRef}
            role="button"
            tabIndex={0}
          />

          {gameState === "playing" && statusText ? (
            <p className="dsf-status-toast">{statusText}</p>
          ) : null}

          {grouperAlert ? (
            <p className="dsf-grouper-alert">{t("games.deepSeaFishing.grouperAlert")}</p>
          ) : null}

          {gameState === "playing" ? (
            <p className="dsf-fire-hint">{t("games.deepSeaFishing.fireHint")}</p>
          ) : null}

          {gameState === "quiz" ? (
            <QuizOverlay
              bubbleStates={bubbleStates}
              feedback={quizFeedback}
              locked={quizLocked}
              onPick={handleQuizPick}
              questionIndex={questionIndex}
              quiz={quiz}
              t={t}
              totalQuestions={quizMeta?.questions.length ?? 1}
            />
          ) : null}

          {gameState === "rules" ? <RulesPanel onClose={closeRules} t={t} /> : null}

          {gameState === "over" ? (
            <div className="dsf-over-panel">
              <h2 className="dsf-over-title">{t("games.gameOver")}</h2>
              <p className="dsf-over-score">{score}</p>
              <p className="dsf-over-sub">
                {t("games.deepSeaFishing.resultCount", { count: caughtCount })}
              </p>

              <div className="dsf-over-grid">
                {[
                  [t("games.score"), score],
                  [t("games.deepSeaFishing.caught"), caughtCount],
                  [t("games.time"), `${GAME_SECONDS - timeLeft}s`],
                ].map(([label, value]) => (
                  <div className="dsf-summary-card" key={label}>
                    <p className="text-xs font-bold uppercase text-sky-200">{label}</p>
                    <p className="text-2xl font-black text-yellow-300">{value}</p>
                  </div>
                ))}
              </div>

              <div className="dsf-review-box">
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

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button className="dsf-primary-btn" onClick={startGame} type="button">
                  {t("games.playAgain")}
                </button>
                <Link className="dsf-secondary-btn" to="/">
                  {t("common.home")}
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {gameState === "rules" || gameState === "over" ? (
        <GameWordBankStatus
          className="game-page-footer mt-1 block text-center text-xs text-sky-200"
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

export default DeepSeaFishingPage;
