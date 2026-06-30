import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GameHomeButton from "../components/GameHomeButton.jsx";
import GameMistakeSummary from "../components/GameMistakeSummary.jsx";
import GameWordBankStatus from "../components/GameWordBankStatus.jsx";
import GameWordWithSpeak from "../components/GameWordWithSpeak.jsx";
import WordGroupScopeEmptyState from "../features/wordGroups/WordGroupScopeEmptyState.jsx";
import { useActiveGroupWordScope } from "../features/wordGroups/useActiveGroupWordScope.js";
import {
  normalizeGameWord,
  pickNinjaWord,
} from "../features/games/gameWordBank.js";
import { useReviewSessionPlay } from "../features/games/useReviewSessionPlay.js";
import { hasActiveReviewSession } from "../lib/reviewSessionStorage.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useGameMistakeTracker } from "../features/review/useGameMistakeTracker.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
const maxHp = 3;
const maxTime = 30;

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function getGameId(prefix) {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${prefix}-${randomId}`;
}

function playTone(freq = 440, duration = 0.1, type = "sine", volume = 0.04) {
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
    // Audio is optional; keep the game playable without it.
  }
}

function createLetters(word, level) {
  const mainLetters = word.split("").map((letter, index) => ({
    id: getGameId(`m-${index}`),
    letter,
    used: false,
    bomb: false,
  }));
  const distractorCount = Math.min(10, 3 + Math.floor(level / 2));
  const distractors = Array.from({ length: distractorCount }, () => ({
    id: getGameId("d"),
    letter: alphabet[Math.floor(Math.random() * alphabet.length)],
    used: false,
    bomb: false,
  }));
  const bombCount = level >= 3 ? Math.min(3, 1 + Math.floor(level / 4)) : 0;
  const bombs = Array.from({ length: bombCount }, () => ({
    id: getGameId("b"),
    letter: alphabet[Math.floor(Math.random() * alphabet.length)],
    used: false,
    bomb: true,
  }));

  return shuffleArray([...mainLetters, ...distractors, ...bombs]);
}

function createRound(entries, wordBank, level, pickWord) {
  const word = pickWord
    ? pickWord({ level })
    : pickNinjaWord(entries, wordBank, level);

  return {
    word,
    letters: createLetters(word.word, level),
    targetIndex: 0,
  };
}

function SpellingNinjaPage() {
  const { t } = useLocale();
  const { user, words } = useWordsContext();
  const { isLoadingScope, isGroupScopeActive, scopedWords } = useActiveGroupWordScope(words, user);
  const gameWords = isGroupScopeActive ? scopedWords : words;
  const { commitMistakes, lastCommittedTerms, recordCorrect, recordWrong, resetTracker } =
    useGameMistakeTracker();
  const gameOptions = useMemo(
    () => ({
      minLength: 3,
      minWords: 3,
      normalizeWord: normalizeGameWord,
    }),
    [],
  );
  const { beginPlaySession, defaultBank, getActivePlayBank, pickNextEntry } =
    useReviewSessionPlay(gameWords, gameOptions);
  const {
    entries,
    isPriorityLimited,
    priorityCount,
    priorityWordIds,
    supplementedCount,
    totalMaintenanceCount,
    totalPriorityCount,
    usingFallback,
    usingMaintenanceMode,
  } = defaultBank;

  const pickWordForBank = useCallback(
    (bank) => () => pickNextEntry(bank),
    [pickNextEntry],
  );

  const [gameState, setGameState] = useState("start");
  const [round, setRound] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [hp, setHp] = useState(maxHp);
  const [timeLeft, setTimeLeft] = useState(maxTime);
  const [level, setLevel] = useState(1);
  const [fever, setFever] = useState(0);
  const [feverActive, setFeverActive] = useState(false);
  const [correctWords, setCorrectWords] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [missedWords, setMissedWords] = useState([]);
  const [defeatedWords, setDefeatedWords] = useState([]);
  const [status, setStatus] = useState({ text: "", type: "" });
  const [roundLocked, setRoundLocked] = useState(false);
  const [flash, setFlash] = useState("");
  const [slashKey, setSlashKey] = useState(0);

  const startRound = useCallback(
    (nextLevel) => {
      const bank = getActivePlayBank();
      const nextRound = createRound(
        bank.entries,
        bank,
        nextLevel,
        pickWordForBank(bank),
      );

      setRound(nextRound);
      setTimeLeft(Math.max(12, maxTime - Math.floor(nextLevel * 1.3)));
      setRoundLocked(false);
      setStatus({ text: "", type: "" });
      setFlash("");
      setSlashKey((value) => value + 1);
    },
    [getActivePlayBank, pickWordForBank],
  );

  function startGame() {
    resetTracker();
    const bank = beginPlaySession();
    const firstRound = createRound(
      bank.entries,
      bank,
      1,
      pickWordForBank(bank),
    );

    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setHp(maxHp);
    setLevel(1);
    setFever(0);
    setFeverActive(false);
    setCorrectWords(0);
    setMistakes(0);
    setMissedWords([]);
    setDefeatedWords([]);
    setRound(firstRound);
    setTimeLeft(Math.max(12, maxTime - Math.floor(1 * 1.3)));
    setRoundLocked(false);
    setStatus({ text: "", type: "" });
    setFlash("");
    setGameState("playing");
  }

  const endGame = useCallback(() => {
    commitMistakes();
    setGameState("over");
    setRoundLocked(true);
  }, [commitMistakes]);

  const addMissedWord = useCallback((word) => {
    setMissedWords((currentWords) => {
      if (currentWords.some((item) => item.word === word.word)) {
        return currentWords;
      }

      return [...currentWords, word];
    });
  }, []);

  const handleMistake = useCallback(
    (text) => {
      setMistakes((count) => count + 1);
      setCombo(0);
      setFever((value) => Math.max(0, value - 25));
      setFeverActive(false);
      setStatus({ text, type: "bad" });
      setFlash("bad");
      playTone(150, 0.16, "sawtooth", 0.035);

      if (round?.word) {
        recordWrong(round.word.word);
        addMissedWord(round.word);
      }

      setHp((currentHp) => {
        const nextHp = currentHp - 1;

        if (nextHp <= 0) {
          window.setTimeout(endGame, 650);
        }

        return Math.max(0, nextHp);
      });
    },
    [addMissedWord, endGame, recordWrong, round],
  );

  const completeWord = useCallback(() => {
    if (!round?.word) return;

    recordCorrect(round.word.word);
    setRoundLocked(true);
    setCorrectWords((count) => count + 1);
    setDefeatedWords((currentWords) => [...currentWords, round.word]);
    setScore((value) => value + (feverActive ? 35 : 20) + Math.max(0, timeLeft));
    setFever(0);
    setFeverActive(false);
    setStatus({
      text: t("games.correct"),
      type: "bonus",
    });
    setFlash("good");
    playTone(880, 0.08, "triangle", 0.045);

    window.setTimeout(() => {
      setLevel((currentLevel) => {
        const nextLevel = currentLevel + 1;

        if (nextLevel % 4 === 0) {
          setHp((currentHp) => Math.min(maxHp, currentHp + 1));
        }

        startRound(nextLevel);
        return nextLevel;
      });
    }, 900);
  }, [feverActive, recordCorrect, round, startRound, t, timeLeft]);

  const handleTimeout = useCallback(() => {
    if (!round || roundLocked) return;

    setRoundLocked(true);
    recordWrong(round.word.word);
    addMissedWord(round.word);
    setMistakes((count) => count + 1);
    setCombo(0);
    setFever((value) => Math.max(0, value - 30));
    setFeverActive(false);
    setStatus({ text: t("games.ninja.missed", { word: round.word.word }), type: "bad" });
    setFlash("bad");
    playTone(120, 0.2, "sawtooth", 0.035);

    setHp((currentHp) => {
      const nextHp = currentHp - 1;

      if (nextHp <= 0) {
        window.setTimeout(endGame, 650);
      } else {
        window.setTimeout(() => {
          setLevel((currentLevel) => {
            const nextLevel = currentLevel + 1;
            startRound(nextLevel);
            return nextLevel;
          });
        }, 750);
      }

      return Math.max(0, nextHp);
    });
  }, [addMissedWord, endGame, recordWrong, round, roundLocked, startRound, t]);

  const pressLetter = useCallback(
    (id) => {
      if (!round || roundLocked || gameState !== "playing") return;

      const item = round.letters.find((letter) => letter.id === id);
      if (!item || item.used) return;

      const expected = round.word.word[round.targetIndex];

      setRound((currentRound) => ({
        ...currentRound,
        letters: currentRound.letters.map((letter) =>
          letter.id === id ? { ...letter, used: true } : letter,
        ),
      }));

      if (item.bomb) {
        handleMistake(t("games.ninja.missed", { word: round.word.word }));
        return;
      }

      if (item.letter !== expected) {
        handleMistake(t("games.ninja.missed", { word: round.word.word }));
        return;
      }

      const nextIndex = round.targetIndex + 1;

      setRound((currentRound) => ({
        ...currentRound,
        targetIndex: nextIndex,
      }));
      setCombo((currentCombo) => {
        const nextCombo = currentCombo + 1;
        setBestCombo((currentBest) => Math.max(currentBest, nextCombo));
        return nextCombo;
      });
      setScore((value) => value + (feverActive ? 8 : 5) + Math.floor(combo / 5));
      setFever((value) => {
        const nextFever = Math.min(100, value + 8);

        if (nextFever >= 100 && !feverActive) {
          setFeverActive(true);
          setStatus({ text: t("games.ninja.fever"), type: "bonus" });
          playTone(1000, 0.13, "triangle", 0.045);
        } else {
          setStatus({ text: t("games.ninja.slashCorrect"), type: "good" });
        }

        return nextFever;
      });
      setFlash("good");
      setSlashKey((key) => key + 1);
      playTone(650 + nextIndex * 40, 0.07, "triangle", 0.035);

      if (nextIndex >= round.word.word.length) {
        window.setTimeout(completeWord, 120);
      }
    },
    [
      combo,
      completeWord,
      feverActive,
      gameState,
      handleMistake,
      round,
      roundLocked,
      t,
    ],
  );

  useEffect(() => {
    if (gameState !== "playing" || roundLocked) return undefined;

    const timerId = window.setInterval(() => {
      setTimeLeft((currentTime) => {
        if (currentTime <= 1) {
          window.clearInterval(timerId);
          handleTimeout();
          return 0;
        }

        return currentTime - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [gameState, handleTimeout, roundLocked]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!round || gameState !== "playing" || roundLocked) return;

      const key = event.key.toLowerCase();
      if (!alphabet.includes(key)) return;

      const match = round.letters.find((item) => !item.used && item.letter === key);

      if (match) {
        pressLetter(match.id);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [gameState, pressLetter, round, roundLocked]);

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

  const typedLetters = round?.word.word.slice(0, round.targetIndex).split("") ?? [];
  const remainingSlots = round ? round.word.word.length - typedLetters.length : 0;
  const isBoss = level % 5 === 0;
  const timerPercent = Math.max(0, (timeLeft / maxTime) * 100);
  const accuracy =
    correctWords + mistakes > 0
      ? Math.round((correctWords / (correctWords + mistakes)) * 100)
      : 0;

  return (
    <section className="game-page-shell flex flex-col bg-slate-950 text-slate-50">
      <header className="game-page-header relative z-50 mb-1.5 flex shrink-0 items-center justify-between gap-2">
        <GameHomeButton fixed />
        <div className="pointer-events-none flex-1 text-center">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-300 sm:text-xs">
            {t("games.ninja.title")}
          </p>
          <h1 className="font-black tracking-tight text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.5)]">
            {t("games.ninja.title")}
          </h1>
          <p className="text-slate-400">
            {t("games.ninja.subtitle")}
          </p>
        </div>
        <div className="min-w-[4.5rem]" />
      </header>

      {gameState === "playing" ? (
        <>
          <div className="mb-1.5 grid grid-cols-6 gap-1.5">
            {[
              [t("games.score"), score, "text-cyan-300"],
              [t("games.combo"), combo, "text-yellow-300"],
              [t("games.hp"), `${hp}/${maxHp}`, "text-rose-300"],
              [t("games.time"), timeLeft, "text-green-300"],
              [t("games.level"), level, "text-purple-300"],
              ["FEVER", feverActive ? "FEVER" : `${fever}%`, "text-orange-300"],
            ].map(([label, value, color]) => (
              <div
                className="rounded-lg border border-slate-700/70 bg-slate-900/90 px-1 py-1 text-center sm:rounded-2xl sm:px-2 sm:py-2"
                key={label}
              >
                <p className="text-xs font-bold uppercase text-slate-400 sm:text-xs">
                  {label}
                </p>
                <p className={`text-sm font-black sm:text-2xl ${color}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-2 h-2 overflow-hidden rounded-full border border-slate-700 bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-green-300 transition-all"
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        </>
      ) : null}

      <div
        className={[
          "relative min-h-0 flex-1 overflow-hidden rounded-[1.25rem] border border-cyan-300/30 bg-slate-900 p-2 shadow-[0_0_34px_rgba(34,211,238,0.09)] sm:p-5",
          flash === "good" ? "spelling-ninja-flash-good" : "",
          flash === "bad" ? "spelling-ninja-flash-bad spelling-ninja-shake" : "",
        ].join(" ")}
      >
        {gameState === "start" ? (
          <div className="text-center">
            <div className="spelling-ninja-dojo mb-4 rounded-3xl border border-slate-700/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                {t("games.demoMode")}
              </p>
              <div className="spelling-ninja-enemy spelling-ninja-enemy-compact mx-auto mt-5">
                🥷
              </div>
              <h2 className="mt-4 text-3xl font-black text-yellow-300">
                {t("games.startGame")}
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
                {t("games.ninja.startHint")}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                className="rounded-2xl bg-gradient-to-r from-cyan-300 to-green-300 px-7 py-3 text-base font-black text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5"
                onClick={startGame}
                type="button"
              >
                {t("games.startGame")}
              </button>
            </div>
          </div>
        ) : null}

        {gameState === "playing" && round ? (
          <div>
            <div className="spelling-ninja-dojo relative mb-1.5 overflow-hidden rounded-2xl border border-slate-700/70 p-2 text-center sm:rounded-3xl sm:p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400 sm:text-xs">
                {isBoss ? "Boss Word" : "Ninja Dojo"} | {t("games.level")} {level}
              </p>

              <div
                className={[
                  "spelling-ninja-stage mx-auto mt-1",
                  isBoss ? "spelling-ninja-stage-boss" : "",
                ].join(" ")}
              >
                <div
                  className={[
                    "spelling-ninja-enemy spelling-ninja-enemy-compact",
                    isBoss ? "spelling-ninja-boss" : "",
                  ].join(" ")}
                >
                  {isBoss ? "👹" : "👾"}
                </div>
                <div className="spelling-ninja-slash" key={slashKey} />
              </div>

              <div className="spelling-ninja-word-panel relative z-10 mt-4 w-full sm:mt-5">
                <GameWordWithSpeak
                  className="text-xl font-black leading-tight text-yellow-300 sm:text-4xl"
                  speakAs={round.word.word}
                  text={round.word.meaning}
                />
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:text-xs">
                  {t("games.partOfSpeech", { type: round.word.type })} | {round.word.word.length} | {Math.min(round.targetIndex + 1, round.word.word.length)}/{round.word.word.length}
                </p>
              </div>

              <div className="mx-auto mt-2 flex max-w-3xl flex-wrap justify-center gap-1 sm:gap-2">
                {typedLetters.map((letter, index) => (
                  <div
                    className="grid size-7 place-items-center rounded-lg border-2 border-cyan-300 bg-cyan-400/20 text-base font-black text-cyan-200 sm:size-11 sm:text-2xl"
                    key={`${letter}-${index}`}
                  >
                    {letter}
                  </div>
                ))}
                {Array.from({ length: remainingSlots }).map((_, index) => (
                  <div
                    className="grid size-7 place-items-center rounded-lg border-2 border-slate-600 bg-slate-950/50 text-base font-black text-slate-500 sm:size-11 sm:text-2xl"
                    key={`slot-${index}`}
                  >
                    ?
                  </div>
                ))}
              </div>
            </div>

            <div
              className={[
                "min-h-5 text-center text-xs font-black sm:text-lg",
                status.type === "good" ? "text-green-300" : "",
                status.type === "bad" ? "text-rose-300" : "",
                status.type === "bonus" ? "text-yellow-300" : "",
              ].join(" ")}
            >
              {status.text}
            </div>

            <div className="mt-1.5 rounded-2xl border border-slate-700 bg-slate-950/60 p-1.5 sm:p-3">
              <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-8 sm:gap-2" key={level}>
                {round.letters.map((item) => (
                  <button
                    className={[
                      "min-h-8 rounded-lg border border-slate-600 text-base font-black uppercase text-white shadow-lg transition hover:-translate-y-1 disabled:translate-y-0 disabled:opacity-30 sm:min-h-12 sm:rounded-xl sm:text-2xl",
                      item.bomb
                        ? "animate-pulse bg-gradient-to-br from-red-900 to-red-500"
                        : "bg-slate-800 hover:border-cyan-300 hover:bg-cyan-700",
                      item.used && !item.bomb ? "bg-green-600" : "",
                    ].join(" ")}
                    disabled={item.used || roundLocked}
                    key={item.id}
                    onClick={() => pressLetter(item.id)}
                    type="button"
                  >
                    {item.bomb ? "💣" : item.letter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {gameState === "over" ? (
          <div className="text-center">
            <div className="spelling-ninja-dojo mb-3 rounded-3xl border border-slate-700/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                {t("games.result")}
              </p>
              <div className="spelling-ninja-stage mx-auto mt-3">
                <div className="spelling-ninja-enemy spelling-ninja-boss spelling-ninja-enemy-compact">
                  💀
                </div>
              </div>
              <h2 className="mt-5 text-3xl font-black text-rose-300">
                {t("games.gameOver")}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[
                [t("games.score"), score],
                [t("games.level"), level],
                [t("games.bestCombo"), bestCombo],
                [t("games.accuracy"), `${accuracy}%`],
              ].map(([label, value]) => (
                <div className="rounded-2xl bg-slate-800 p-3" key={label}>
                  <p className="text-xs font-bold uppercase text-slate-400">
                    {label}
                  </p>
                  <p className="mt-0.5 text-2xl font-black text-cyan-300">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <GameMistakeSummary className="mt-3 text-left" terms={lastCommittedTerms} />

            <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-3 text-left">
              <h3 className="text-base font-black text-cyan-200">
                {t("games.ninja.missedWords")}
              </h3>
              {missedWords.length === 0 ? (
                <p className="mt-1 text-sm text-slate-300">
                  {t("games.ninja.perfectMissed")}
                </p>
              ) : (
                <ul className="mt-2 grid max-h-24 gap-1.5 overflow-y-auto">
                  {missedWords.map((item) => (
                    <li
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                      key={item.word}
                    >
                      <span className="font-black text-cyan-300">{item.word}</span>
                      <span className="mx-2 text-slate-500">→</span>
                      <span className="text-slate-300">{item.meaning}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                className="rounded-2xl bg-gradient-to-r from-cyan-300 to-green-300 px-5 py-2.5 font-black text-slate-950 transition hover:-translate-y-0.5"
                onClick={startGame}
                type="button"
              >
                {t("games.playAgain")}
              </button>
              <Link
                className="rounded-2xl bg-slate-800 px-5 py-2.5 font-black text-white transition hover:-translate-y-0.5"
                to="/"
              >
                {t("common.home")}
              </Link>
              <Link
                className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-2.5 font-black text-slate-200 transition hover:-translate-y-0.5"
                to="/words"
              >
                {t("nav.words")}
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {gameState === "playing" ? null : (
        <p className="game-page-footer mt-1 text-center text-xs text-slate-400">
          <GameWordBankStatus
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
          {defeatedWords.length > 0
            ? ` ${t("games.ninja.resultCount", { count: defeatedWords.length })}`
            : ""}
        </p>
      )}
    </section>
  );
}

export default SpellingNinjaPage;
