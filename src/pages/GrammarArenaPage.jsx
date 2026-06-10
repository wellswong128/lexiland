import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GameHomeButton from "../components/GameHomeButton.jsx";
import LanguageToggle from "../components/LanguageToggle.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";

const grammarBank = [
  {
    sentence: "She _____ to school every day.",
    answer: "goes",
    choices: ["go", "goes", "going", "gone"],
    tag: "Present Simple",
    explain: "主詞 She 是第三人稱單數，現在簡單式動詞要加 s，所以是 goes。",
  },
  {
    sentence: "They _____ soccer yesterday.",
    answer: "played",
    choices: ["play", "plays", "played", "playing"],
    tag: "Past Simple",
    explain: "yesterday 表示過去時間，所以動詞用過去式 played。",
  },
  {
    sentence: "I am good _____ English.",
    answer: "at",
    choices: ["in", "on", "at", "for"],
    tag: "Preposition",
    explain: "be good at 是固定用法，意思是擅長。",
  },
  {
    sentence: "There _____ many books on the table.",
    answer: "are",
    choices: ["is", "are", "be", "am"],
    tag: "There is / are",
    explain: "many books 是複數，所以要用 There are。",
  },
  {
    sentence: "This is the book _____ I bought.",
    answer: "that",
    choices: ["who", "where", "that", "when"],
    tag: "Relative Pronoun",
    explain: "先行詞 book 是物，關係代名詞可以用 that。",
  },
  {
    sentence: "If it rains, we _____ at home.",
    answer: "will stay",
    choices: ["stay", "stayed", "will stay", "staying"],
    tag: "First Conditional",
    explain: "第一類條件句：If + 現在式，主要子句用 will + 原形動詞。",
  },
  {
    sentence: "He has lived here _____ 2020.",
    answer: "since",
    choices: ["for", "since", "during", "at"],
    tag: "Present Perfect",
    explain: "since 後面接時間點，例如 since 2020。",
  },
  {
    sentence: "The cake was _____ by my sister.",
    answer: "made",
    choices: ["make", "made", "making", "makes"],
    tag: "Passive Voice",
    explain: "被動語態是 be + 過去分詞，所以是 was made。",
  },
  {
    sentence: "You _____ wear a helmet when riding a bike.",
    answer: "should",
    choices: ["should", "can", "may", "would"],
    tag: "Modal Verb",
    explain: "should 表示應該，符合安全建議語氣。",
  },
  {
    sentence: "My brother is taller _____ me.",
    answer: "than",
    choices: ["then", "than", "as", "from"],
    tag: "Comparative",
    explain: "比較級 taller 後面要用 than。",
  },
  {
    sentence: "I have never _____ sushi before.",
    answer: "eaten",
    choices: ["eat", "ate", "eaten", "eating"],
    tag: "Present Perfect",
    explain: "have never 後面接過去分詞，所以是 eaten。",
  },
  {
    sentence: "Please speak _____ because the baby is sleeping.",
    answer: "quietly",
    choices: ["quiet", "quietly", "quieter", "quietness"],
    tag: "Adverb",
    explain: "修飾動詞 speak 要用副詞 quietly。",
  },
];

const demoChoices = ["go", "goes", "going", "gone"];
const maxTime = 75;

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
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

function createQuestion() {
  const question = grammarBank[Math.floor(Math.random() * grammarBank.length)];
  return {
    ...question,
    shuffledChoices: shuffleArray(question.choices),
  };
}

function Hero({ state = "" }) {
  return (
    <div className={["grammar-arena-hero", state].filter(Boolean).join(" ")}>
      <div className="grammar-arena-helmet" />
      <div className="grammar-arena-hero-head" />
      <div className="grammar-arena-hero-body" />
      <div className="grammar-arena-shield" />
      <div className="grammar-arena-sword" />
      <div className="grammar-arena-legs" />
    </div>
  );
}

function Monster({ state = "" }) {
  return (
    <div className={["grammar-arena-monster", state].filter(Boolean).join(" ")}>
      <div className="grammar-arena-horn left" />
      <div className="grammar-arena-horn right" />
      <div className="grammar-arena-monster-body" />
      <div className="grammar-arena-monster-eye left" />
      <div className="grammar-arena-monster-eye right" />
      <div className="grammar-arena-monster-mouth" />
    </div>
  );
}

function ArenaScene({
  promptLabel,
  sentence,
  tag,
  status,
  heroHp,
  monsterHp,
  heroState,
  monsterState,
  effectType,
  choices,
  onChoose,
  locked,
  answerStates = {},
  answerPanelKey,
  heroHpLabel,
  monsterHpLabel,
}) {
  return (
    <div className="grammar-arena-arena relative h-full min-h-0">
      <div className="grammar-arena-prompt-panel">
        <p className="grammar-arena-prompt-label">{promptLabel}</p>
        <p className="grammar-arena-sentence">{sentence}</p>
        {tag ? <span className="grammar-arena-grammar-tag">{tag}</span> : null}
        {status.text ? (
          <p
            className={[
              "grammar-arena-status",
              status.type === "good" ? "good" : "",
              status.type === "bad" ? "bad" : "",
            ].join(" ")}
          >
            {status.text}
          </p>
        ) : (
          <p className="grammar-arena-status">{status.text}</p>
        )}
      </div>

      <div className="grammar-arena-battle-zone">
        <div className="grammar-arena-torch left" />
        <div className="grammar-arena-torch right" />

        <div className="grammar-arena-hp-bars">
          <div className="grammar-arena-hp-box">
            <p className="grammar-arena-hp-name">{heroHpLabel}</p>
            <div className="grammar-arena-hp-track">
              <div
                className="grammar-arena-hp-fill"
                style={{ width: `${Math.max(0, heroHp)}%` }}
              />
            </div>
          </div>
          <div className="grammar-arena-hp-box monster-hp">
            <p className="grammar-arena-hp-name">{monsterHpLabel}</p>
            <div className="grammar-arena-hp-track">
              <div
                className="grammar-arena-hp-fill"
                style={{ width: `${Math.max(0, monsterHp)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grammar-arena-fighters">
          <Hero state={heroState} />
          <Monster state={monsterState} />
          {effectType ? (
            <div className={`grammar-arena-effect ${effectType}`} key={effectType} />
          ) : null}
        </div>
      </div>

      <div className="grammar-arena-answer-panel" key={answerPanelKey}>
        {choices.map((choice, index) => (
          <button
            className={[
              "grammar-arena-answer-btn",
              answerStates[choice] ?? "",
            ].join(" ")}
            disabled={locked || !onChoose}
            key={`${answerPanelKey}-${index}-${choice}`}
            onClick={() => onChoose?.(choice)}
            type="button"
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}

function GrammarArenaPage() {
  const { t } = useLocale();

  const [gameState, setGameState] = useState("start");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(maxTime);
  const [round, setRound] = useState(1);
  const [heroHp, setHeroHp] = useState(100);
  const [monsterHp, setMonsterHp] = useState(100);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [reviewItems, setReviewItems] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState({ text: "", type: "" });
  const [heroState, setHeroState] = useState("");
  const [monsterState, setMonsterState] = useState("");
  const [effectType, setEffectType] = useState("");
  const [answerStates, setAnswerStates] = useState({});
  const [endReason, setEndReason] = useState("");

  const resetCombatAnim = useCallback(() => {
    setHeroState("");
    setMonsterState("");
    setEffectType("");
    setAnswerStates({});
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimeLeft(maxTime);
    setRound(1);
    setHeroHp(100);
    setMonsterHp(100);
    setCorrectCount(0);
    setWrongCount(0);
    setReviewItems([]);
    setLocked(false);
    setStatus({ text: "", type: "" });
    resetCombatAnim();
    setCurrentQuestion(createQuestion());
    setGameState("playing");
  }, [resetCombatAnim]);

  const endGame = useCallback(
    (reason) => {
      setGameState("over");
      setLocked(true);
      setEndReason(reason);
      resetCombatAnim();
    },
    [resetCombatAnim],
  );

  const resetOptionState = useCallback(() => {
    resetCombatAnim();
    setLocked(false);
  }, [resetCombatAnim]);

  const nextQuestion = useCallback(
    (monsterDefeated = false) => {
      resetOptionState();
      setStatus({ text: "", type: "" });
      if (monsterDefeated) {
        setMonsterHp(100);
      }
      setRound((value) => value + 1);
      setCurrentQuestion(createQuestion());
    },
    [resetOptionState],
  );

  const chooseAnswer = useCallback(
    (answer) => {
      if (locked || !currentQuestion) return;

      setLocked(true);

      const states = {};
      currentQuestion.shuffledChoices.forEach((choice) => {
        if (choice === currentQuestion.answer) states[choice] = "correct";
        if (choice === answer && answer !== currentQuestion.answer) {
          states[choice] = "wrong";
        }
      });
      setAnswerStates(states);

      if (answer === currentQuestion.answer) {
        const nextCombo = combo + 1;
        const damage = 25 + Math.min(20, nextCombo * 3);
        const gain = 120 + nextCombo * 18 + damage;
        const nextMonsterHp = Math.max(0, monsterHp - damage);

        setCombo(nextCombo);
        setBestCombo((value) => Math.max(value, nextCombo));
        setCorrectCount((value) => value + 1);
        setMonsterHp(nextMonsterHp);
        setScore((value) => value + gain);
        setHeroState("attack");
        setStatus({ text: t("games.grammarArena.hit", { gain }), type: "good" });

        window.setTimeout(() => setMonsterState("hit"), 210);
        window.setTimeout(() => setEffectType("slash"), 210);

        playTone(620, 0.08, "triangle", 0.04);
        window.setTimeout(() => playTone(900, 0.1, "triangle", 0.04), 90);

        window.setTimeout(() => {
          nextQuestion(nextMonsterHp <= 0);
        }, 900);
      } else {
        const nextHeroHp = Math.max(0, heroHp - 20);
        const nextTimeLeft = Math.max(0, timeLeft - 5);

        setCombo(0);
        setWrongCount((value) => value + 1);
        setHeroHp(nextHeroHp);
        setTimeLeft(nextTimeLeft);
        setReviewItems((items) =>
          items.some((item) => item.sentence === currentQuestion.sentence)
            ? items
            : [...items, currentQuestion],
        );
        setMonsterState("attack");
        setStatus({
          text: t("games.grammarArena.countered", { answer: currentQuestion.answer }),
          type: "bad",
        });

        window.setTimeout(() => setHeroState("hit"), 210);
        window.setTimeout(() => setEffectType("blast"), 210);

        playTone(160, 0.16, "sawtooth", 0.035);

        if (nextHeroHp <= 0) {
          window.setTimeout(() => endGame(t("games.grammarArena.heroDown")), 900);
          return;
        }

        if (nextTimeLeft <= 0) {
          window.setTimeout(() => endGame(t("games.grammarArena.timeUp")), 900);
          return;
        }

        window.setTimeout(() => nextQuestion(false), 1100);
      }
    },
    [
      combo,
      currentQuestion,
      endGame,
      heroHp,
      locked,
      monsterHp,
      nextQuestion,
      t,
      timeLeft,
    ],
  );

  useEffect(() => {
    if (gameState !== "playing") return undefined;

    const timerId = window.setInterval(() => {
      if (locked) return;

      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timerId);
          endGame(t("games.grammarArena.timeUp"));
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [endGame, gameState, locked, t]);

  const timerPercent = Math.max(0, (timeLeft / maxTime) * 100);
  const totalAttempts = correctCount + wrongCount;
  const accuracy = useMemo(
    () => (totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0),
    [correctCount, totalAttempts],
  );

  return (
    <section className="grammar-arena-app flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] p-2 sm:p-4">
      <header className="relative z-50 mb-2 flex shrink-0 items-center justify-between gap-2">
        {gameState === "playing" ? <GameHomeButton /> : <div className="min-w-[4.5rem]" />}
        <div className="pointer-events-none flex-1 text-center">
          <h1 className="text-3xl font-black text-amber-50 drop-shadow sm:text-5xl">
            {t("games.grammarArena.title")}
          </h1>
          <p className="text-xs text-sky-100 sm:text-sm">
            {t("games.grammarArena.subtitle")}
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
              [t("games.heroHp"), heroHp, "text-red-300"],
              [t("games.round"), round, "text-purple-200"],
            ].map(([label, value, color]) => (
              <div className="grammar-arena-stat" key={label}>
                <p className="text-xs font-bold uppercase text-sky-200 sm:text-xs">
                  {label}
                </p>
                <p className={`text-sm font-black sm:text-xl ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mb-2 h-2 overflow-hidden rounded-full border border-white/20 bg-slate-950/40">
            <div
              className="grammar-arena-timer-bar h-full rounded-full transition-all"
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

      <div className="grammar-arena-card relative z-0 min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
        {gameState === "start" ? (
          <div className="flex h-full flex-col overflow-y-auto text-center">
            <div className="relative min-h-0 flex-1">
              <ArenaScene
                choices={demoChoices}
                heroHp={100}
                heroHpLabel={t("games.heroHp")}
                locked
                monsterHp={100}
                monsterHpLabel={t("games.monsterHp")}
                promptLabel={t("games.demoMode")}
                sentence={t("games.grammarArena.title")}
                status={{ text: t("games.grammarArena.demoStatus"), type: "" }}
                tag={t("games.grammarArena.demoTag")}
              />
            </div>
            <div className="mt-3 shrink-0">
              <p className="text-sm text-sky-100">
                {t("games.grammarArena.startHint")}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  className="grammar-arena-primary-btn"
                  onClick={startGame}
                  type="button"
                >
                  {t("games.startGame")}
                </button>
                <Link className="grammar-arena-secondary-btn" to="/">
                  {t("common.home")}
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {gameState === "playing" && currentQuestion ? (
          <ArenaScene
            answerPanelKey={`${round}-${currentQuestion.sentence}`}
            answerStates={answerStates}
            choices={currentQuestion.shuffledChoices}
            effectType={effectType}
            heroHp={heroHp}
            heroHpLabel={t("games.heroHp")}
            heroState={heroState}
            locked={locked}
            monsterHp={monsterHp}
            monsterHpLabel={t("games.monsterHp")}
            monsterState={monsterState}
            onChoose={chooseAnswer}
            promptLabel={t("games.chooseCorrectAnswer")}
            sentence={currentQuestion.sentence}
            status={status}
            tag={currentQuestion.tag}
          />
        ) : null}

        {gameState === "over" ? (
          <div className="flex h-full flex-col overflow-y-auto text-center">
            <div className="relative min-h-[14rem] shrink-0">
              <ArenaScene
                choices={["Grammar", "Arena", "Review", "Score"]}
                heroHp={heroHp}
                heroHpLabel={t("games.heroHp")}
                locked
                monsterHp={monsterHp}
                monsterHpLabel={t("games.monsterHp")}
                promptLabel={t("games.gameOver")}
                sentence={t("games.result")}
                status={{
                  text: t("games.grammarArena.resultCount", { count: correctCount }),
                  type: "",
                }}
                tag={endReason}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                [t("games.score"), score],
                [t("games.correct"), correctCount],
                [t("games.bestCombo"), bestCombo],
                [t("games.accuracy"), `${accuracy}%`],
              ].map(([label, value]) => (
                <div className="grammar-arena-summary-card" key={label}>
                  <p className="text-xs font-bold uppercase text-sky-200">
                    {label}
                  </p>
                  <p className="text-2xl font-black text-yellow-300">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-white/15 bg-slate-950/35 p-3 text-left">
              <h3 className="font-black text-sky-100">{t("games.grammarArena.reviewTitle")}</h3>
              {reviewItems.length === 0 ? (
                <p className="mt-1 text-sm text-sky-200">{t("games.perfectNoMistakes")}</p>
              ) : (
                <ul className="mt-2 grid max-h-28 gap-1.5 overflow-y-auto">
                  {reviewItems.map((item) => (
                    <li
                      className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
                      key={item.sentence}
                    >
                      <p className="font-black text-yellow-300">{item.sentence}</p>
                      <p className="mt-1 text-sky-200">
                        <span className="text-sky-400">{t("games.answerLabel")}</span>
                        {item.answer}
                      </p>
                      <p className="mt-1 text-slate-300">{item.explain}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-2 pb-1">
              <button
                className="grammar-arena-primary-btn"
                onClick={startGame}
                type="button"
              >
                {t("games.playAgain")}
              </button>
              <Link className="grammar-arena-secondary-btn" to="/">
                {t("common.home")}
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {gameState === "playing" ? null : (
        <p className="mt-2 text-center text-xs text-sky-200">
          {t("games.builtInGrammar")}
        </p>
      )}
    </section>
  );
}

export default GrammarArenaPage;
