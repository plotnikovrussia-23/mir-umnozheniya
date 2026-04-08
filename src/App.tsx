import { CSSProperties, useEffect, useRef, useState } from "react";
import { AudioEngine } from "./audio";
import { worldMap, worlds } from "./worlds";
import {
  AudioSettings,
  GameScreen,
  LearningCard,
  MedalTier,
  ProgressState,
  QuizQuestion,
  WorldConfig,
} from "./types";

const STORAGE_KEY = "multiplication-adventure-medals";

const medalScore: Record<MedalTier, number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
};

const successLines = [
  "Отлично!",
  "Супер!",
  "Я вижу, у тебя получается!",
];

const errorLines = [
  "Ничего, давай разберёмся.",
  "Почти получилось.",
  "Попробуй ещё раз.",
];

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function buildQuestions(multiplier: number, factors: number[], count: number) {
  return shuffle(factors)
    .slice(0, count)
    .map((factor) => ({
      multiplier,
      factor,
      answer: multiplier * factor,
    }));
}

function getMedalTier(score: number): MedalTier {
  if (score >= 8) {
    return "gold";
  }
  if (score === 7) {
    return "silver";
  }
  if (score === 6) {
    return "bronze";
  }
  return "none";
}

function loadProgress(): ProgressState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressState) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: ProgressState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function medalLabel(tier: MedalTier) {
  switch (tier) {
    case "gold":
      return "Золото";
    case "silver":
      return "Серебро";
    case "bronze":
      return "Бронза";
    default:
      return "Пока пусто";
  }
}

function medalEmoji(tier: MedalTier) {
  switch (tier) {
    case "gold":
      return "🏆";
    case "silver":
      return "🥈";
    case "bronze":
      return "🥉";
    default:
      return "◻";
  }
}

function getRandomLine(lines: string[]) {
  return lines[Math.floor(Math.random() * lines.length)];
}

function App() {
  const [screen, setScreen] = useState<GameScreen>("splash");
  const [learningRange, setLearningRange] = useState<"short" | "full">("short");
  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(2);
  const [spinning, setSpinning] = useState(false);
  const [wheelPreview, setWheelPreview] = useState<number>(2);
  const [learningIndex, setLearningIndex] = useState(0);
  const [learningStates, setLearningStates] = useState<Record<number, string>>({});
  const [warmupQuestions, setWarmupQuestions] = useState<QuizQuestion[]>([]);
  const [warmupIndex, setWarmupIndex] = useState(0);
  const [warmupInput, setWarmupInput] = useState("");
  const [warmupMessage, setWarmupMessage] = useState("Без спешки. Здесь можно потренироваться.");
  const [warmupAttempts, setWarmupAttempts] = useState(0);
  const [warmupHintsUsed, setWarmupHintsUsed] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizInput, setQuizInput] = useState("");
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizMessage, setQuizMessage] = useState("Готов? Давай проверим знания.");
  const [quizAttempts, setQuizAttempts] = useState(0);
  const [quizHintsUsed, setQuizHintsUsed] = useState(0);
  const [resultMedal, setResultMedal] = useState<MedalTier>("none");
  const [feedbackEffect, setFeedbackEffect] = useState<"success" | "error" | null>(null);
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    enabled: true,
    musicStarted: false,
  });
  const audioRef = useRef(new AudioEngine());

  const availableWorlds = worlds.filter((world) =>
    learningRange === "short" ? world.multiplier <= 5 : world.multiplier <= 9,
  );
  const currentWorld = worldMap[selectedMultiplier];
  const totalWorldsCleared = availableWorlds.filter(
    (world) => (progress[world.multiplier] ?? "none") !== "none",
  ).length;

  useEffect(() => {
    const firstAvailable = availableWorlds[0]?.multiplier ?? 2;
    const lastAvailable = availableWorlds[availableWorlds.length - 1]?.multiplier ?? 9;

    if (selectedMultiplier < firstAvailable || selectedMultiplier > lastAvailable) {
      setSelectedMultiplier(firstAvailable);
    }

    if (wheelPreview < firstAvailable || wheelPreview > lastAvailable) {
      setWheelPreview(firstAvailable);
    }
  }, [availableWorlds, selectedMultiplier, wheelPreview]);

  useEffect(() => {
    const timer = window.setTimeout(() => setScreen("home"), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    if (audioSettings.enabled && audioSettings.musicStarted) {
      void audioRef.current.startMusic(true, selectedMultiplier);
    } else {
      audioRef.current.stopMusic();
    }
  }, [audioSettings, selectedMultiplier]);

  async function ensureAudioReady() {
    await audioRef.current.unlock();
    setAudioSettings((current) => {
      if (current.musicStarted) {
        return current;
      }
      return { ...current, musicStarted: true };
    });
  }

  function resetLearning() {
    setLearningIndex(0);
    setLearningStates({});
  }

  function startWorld(multiplier: number) {
    const world = worldMap[multiplier];
    setSelectedMultiplier(multiplier);
    setWarmupQuestions(buildQuestions(multiplier, world.warmupFactors, 2));
    setWarmupIndex(0);
    setWarmupInput("");
    setWarmupAttempts(0);
    setWarmupHintsUsed(0);
    setWarmupMessage("Разминка началась. Ошибаться здесь можно.");
    setQuizQuestions(buildQuestions(multiplier, world.quizFactors, 8));
    setQuizIndex(0);
    setQuizInput("");
    setQuizCorrect(0);
    setQuizAttempts(0);
    setQuizHintsUsed(0);
    setQuizMessage("Проверка впереди. Ты справишься.");
    setResultMedal("none");
    setFeedbackEffect(null);
    resetLearning();
    setScreen("intro");
  }

  function flashEffect(type: "success" | "error") {
    setFeedbackEffect(type);
    window.setTimeout(() => setFeedbackEffect(null), type === "success" ? 900 : 700);
  }

  async function handleSpin() {
    if (spinning) {
      return;
    }

    await ensureAudioReady();
    setSpinning(true);
    const pool = availableWorlds.map((world) => world.multiplier);
    let ticks = 0;

    const spinTimer = window.setInterval(() => {
      ticks += 1;
      const preview = pool[ticks % pool.length];
      setWheelPreview(preview);
    }, 120);

    window.setTimeout(() => {
      window.clearInterval(spinTimer);
      const nextValue = pool[Math.floor(Math.random() * pool.length)];
      setWheelPreview(nextValue);
      setSpinning(false);
      startWorld(nextValue);
    }, 1800);
  }

  async function handleLearningChoice(cardIndex: number, correct: boolean, successText: string) {
    await ensureAudioReady();
    if (correct) {
      void audioRef.current.playTone("success", audioSettings.enabled);
      flashEffect("success");
      setLearningStates((current) => ({ ...current, [cardIndex]: successText }));
      return;
    }

    void audioRef.current.playTone("error", audioSettings.enabled);
    flashEffect("error");
    setLearningStates((current) => ({
      ...current,
      [cardIndex]: "Ничего, давай разберёмся и попробуем ещё раз.",
    }));
  }

  function handleReveal(cardIndex: number, answer: string) {
    setLearningStates((current) => ({ ...current, [cardIndex]: answer }));
  }

  async function submitWarmup() {
    const question = warmupQuestions[warmupIndex];
    if (!question) {
      setScreen("quiz");
      return;
    }

    const numericAnswer = Number(quizOrWarmupValue(warmupInput));
    await ensureAudioReady();

    if (numericAnswer === question.answer) {
      void audioRef.current.playTone("success", audioSettings.enabled);
      flashEffect("success");
      const nextIndex = warmupIndex + 1;
      setWarmupAttempts(0);
      setWarmupMessage(`${getRandomLine(successLines)} Переходим дальше.`);
      setWarmupInput("");
      if (nextIndex >= warmupQuestions.length) {
        window.setTimeout(() => {
          setScreen("quiz");
          setWarmupMessage("Разминка пройдена.");
        }, 900);
        return;
      }
      window.setTimeout(() => {
        setWarmupIndex(nextIndex);
        setWarmupMessage("Новый пример уже готов.");
      }, 900);
      return;
    }

    void audioRef.current.playTone("error", audioSettings.enabled);
    flashEffect("error");
    const nextAttempts = warmupAttempts + 1;
    setWarmupAttempts(nextAttempts);
    if (nextAttempts >= 3) {
      const nextIndex = warmupIndex + 1;
      setWarmupMessage(`Три попытки использованы. Верный ответ: ${question.answer}.`);
      setWarmupInput("");
      setWarmupAttempts(0);
      window.setTimeout(() => {
        if (nextIndex >= warmupQuestions.length) {
          setScreen("quiz");
          return;
        }
        setWarmupIndex(nextIndex);
        setWarmupMessage("Следующий пример. Сейчас получится.");
      }, 1200);
      return;
    }
    setWarmupMessage(`Ничего, давай разберёмся. Осталось попыток: ${3 - nextAttempts}.`);
    setWarmupInput("");
  }

  function useWarmupHint() {
    const question = warmupQuestions[warmupIndex];
    if (!question || warmupAttempts < 1) {
      return;
    }

    flashEffect("success");
    setWarmupHintsUsed((current) => current + 1);
    setWarmupAttempts(0);
    setWarmupInput("");
    const nextIndex = warmupIndex + 1;
    setWarmupMessage(`Подсказка: ${question.multiplier} × ${question.factor} = ${question.answer}.`);

    window.setTimeout(() => {
      if (nextIndex >= warmupQuestions.length) {
        setScreen("quiz");
        setWarmupMessage("Разминка пройдена.");
        return;
      }
      setWarmupIndex(nextIndex);
      setWarmupMessage("Следующий пример уже ждёт.");
    }, 1200);
  }

  async function submitQuiz() {
    const question = quizQuestions[quizIndex];
    if (!question) {
      return;
    }

    const numericAnswer = Number(quizOrWarmupValue(quizInput));
    await ensureAudioReady();

    const isCorrect = numericAnswer === question.answer;
    const nextCorrect = isCorrect ? quizCorrect + 1 : quizCorrect;
    const nextIndex = quizIndex + 1;

    if (isCorrect) {
      void audioRef.current.playTone("success", audioSettings.enabled);
      flashEffect("success");
      setQuizCorrect(nextCorrect);
      setQuizAttempts(0);
      setQuizMessage(`${getRandomLine(successLines)} Следующий пример уже летит.`);
    } else {
      void audioRef.current.playTone("error", audioSettings.enabled);
      flashEffect("error");
      const nextAttempts = quizAttempts + 1;
      if (nextAttempts >= 3) {
        setQuizAttempts(0);
        setQuizMessage(
          `${getRandomLine(errorLines)} Верный ответ: ${question.multiplier} × ${question.factor} = ${question.answer}.`,
        );
      } else {
        setQuizAttempts(nextAttempts);
        setQuizMessage(`${getRandomLine(errorLines)} Осталось попыток: ${3 - nextAttempts}.`);
        setQuizInput("");
        return;
      }
    }

    setQuizInput("");

    if (nextIndex >= quizQuestions.length) {
      const medal = getMedalTier(nextCorrect);
      setResultMedal(medal);
      setProgress((current) => {
        const existing = current[selectedMultiplier] ?? "none";
        if (medalScore[medal] <= medalScore[existing]) {
          return current;
        }
        return { ...current, [selectedMultiplier]: medal };
      });
      window.setTimeout(() => setScreen("result"), 950);
      return;
    }

    window.setTimeout(() => {
      setQuizIndex(nextIndex);
      setQuizMessage("Следующий пример уже ждёт.");
    }, 900);
  }

  function useQuizHint() {
    const question = quizQuestions[quizIndex];
    if (!question || quizAttempts < 1) {
      return;
    }

    flashEffect("success");
    setQuizHintsUsed((current) => current + 1);
    setQuizAttempts(0);
    setQuizInput("");
    const nextIndex = quizIndex + 1;
    setQuizMessage(`Подсказка: ${question.multiplier} × ${question.factor} = ${question.answer}.`);

    if (nextIndex >= quizQuestions.length) {
      const medal = getMedalTier(quizCorrect);
      window.setTimeout(() => {
        setResultMedal(medal);
        setProgress((current) => {
          const existing = current[selectedMultiplier] ?? "none";
          if (medalScore[medal] <= medalScore[existing]) {
            return current;
          }
          return { ...current, [selectedMultiplier]: medal };
        });
        setScreen("result");
      }, 1200);
      return;
    }

    window.setTimeout(() => {
      setQuizIndex(nextIndex);
      setQuizMessage("Следующий пример уже ждёт.");
    }, 1200);
  }

  function restartCurrentWorld() {
    startWorld(selectedMultiplier);
  }

  function renderScene(world: WorldConfig) {
    return (
      <div className={`scene scene--${world.scenery[0]}`}>
        {world.scenery.map((piece) => (
          <span key={piece} className={`scene__piece scene__piece--${piece}`} />
        ))}
      </div>
    );
  }

  const rootStyle = currentWorld
    ? ({
        "--world-accent": currentWorld.accent,
        "--world-accent-soft": currentWorld.accentSoft,
        "--world-accent-strong": currentWorld.accentStrong,
        "--world-background": currentWorld.background,
      } as CSSProperties)
    : undefined;

  return (
    <div className="app-shell" style={rootStyle}>
      {feedbackEffect && <FeedbackOverlay type={feedbackEffect} />}
      <div className="app-frame">
        <header className="topbar">
          <div className="brand">
            <span className="brand__badge">×</span>
            <div>
              <p className="eyebrow">Математическая игра</p>
              <h1>Приключение по таблице умножения</h1>
            </div>
          </div>
          <button
            className="sound-toggle"
            type="button"
            onClick={async () => {
              await ensureAudioReady();
              setAudioSettings((current) => ({ ...current, enabled: !current.enabled }));
            }}
          >
            {audioSettings.enabled ? "Звук: вкл" : "Звук: выкл"}
          </button>
        </header>

        {screen === "splash" && (
          <section className="screen splash">
            <div className="splash__orbit">
              {[2, 3, 4, 5, 6, 7, 8, 9].map((value, index) => (
                <span
                  key={value}
                  className="splash__digit"
                  style={{ ["--digit-index" as "--digit-index"]: index } as CSSProperties}
                >
                  {value}
                </span>
              ))}
            </div>
            <div className="splash__content">
              <p className="eyebrow">Учимся играя</p>
              <h2>Приключение по таблице умножения</h2>
              <p className="splash__subtitle">Учимся играя</p>
              <div className="author-card">
                <strong>Плотников Алексей</strong>
                <span>2-й «В» класс</span>
                <span>Лицей №90</span>
                <span>г. Краснодар</span>
              </div>
            </div>
          </section>
        )}

        {screen === "home" && (
          <section className="screen home">
            <div className="hero-card">
              <div className="character">
                <span className="character__halo" />
                <span className="character__head" />
                <span className="character__body" />
              </div>
              <div className="hero-copy">
                <TeacherGuide
                  compact
                  title="Учитель: Татьяна Николаевна"
                  message="Сегодня тебя ждёт новое математическое приключение. Я буду рядом и подскажу, как решить примеры."
                />
                <h2>Сегодня тебя ждёт новое математическое приключение</h2>
                <p>
                  Сначала тебя научат хитростям, потом ты потренируешься и соберёшь медали.
                </p>
                <div className="mode-picker">
                  <p className="mode-picker__label">Выбери, какую часть таблицы ты уже учишь</p>
                  <div className="mode-picker__options">
                    <button
                      className={`choice-button mode-picker__option ${learningRange === "short" ? "mode-picker__option--active" : ""}`}
                      type="button"
                      onClick={() => setLearningRange("short")}
                    >
                      <strong>До ×5</strong>
                      <span>Только то, что уже выучили</span>
                    </button>
                    <button
                      className={`choice-button mode-picker__option ${learningRange === "full" ? "mode-picker__option--active" : ""}`}
                      type="button"
                      onClick={() => setLearningRange("full")}
                    >
                      <strong>До ×9</strong>
                      <span>Вся таблица умножения</span>
                    </button>
                  </div>
                </div>
                <div className="cta-row">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={async () => {
                      await ensureAudioReady();
                      setScreen("wheel");
                    }}
                  >
                    Играть
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setScreen("medals")}
                  >
                    Мои медали
                  </button>
                </div>
              </div>
            </div>
            <div className="status-strip">
              <div className="stat-chip">
                <strong>{totalWorldsCleared}</strong>
                <span>миров с медалями</span>
              </div>
              <div className="stat-chip">
                <strong>{availableWorlds.length}</strong>
                <span>миров в этом режиме</span>
              </div>
            </div>
          </section>
        )}

        {screen === "wheel" && (
          <section className="screen wheel-screen">
            <div className="wheel-layout">
              <div className={`wheel ${spinning ? "wheel--spinning" : ""}`}>
                {availableWorlds.map((world, index) => (
                  <span
                    key={world.multiplier}
                    className={`wheel__segment ${wheelPreview === world.multiplier ? "wheel__segment--active" : ""}`}
                    style={{ ["--segment-index" as "--segment-index"]: index } as CSSProperties}
                  >
                    ×{world.multiplier}
                  </span>
                ))}
                <div className="wheel__center">×{wheelPreview}</div>
              </div>
              <div className="panel">
                <p className="eyebrow">Колесо случайности</p>
                <h2>Куда отправимся сегодня?</h2>
                <p>
                  Нажми кнопку, и игра выберет мир{" "}
                  {learningRange === "short" ? "от ×2 до ×5." : "от ×2 до ×9."}
                </p>
                <div className="cta-row">
                  <button className="primary-button" type="button" onClick={handleSpin}>
                    {spinning ? "Крутится..." : "Крутить"}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setScreen("home")}>
                    Назад
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen !== "splash" && screen !== "home" && screen !== "wheel" && currentWorld && (
          <div className="world-frame">
            <section className="world-banner" style={{ background: currentWorld.background }}>
              <div>
                <p className="eyebrow">{currentWorld.biome}</p>
                <h2>
                  {currentWorld.title} <span>{currentWorld.badge}</span>
                </h2>
                <p>{currentWorld.subtitle}</p>
              </div>
              {renderScene(currentWorld)}
            </section>

            {screen === "intro" && (
              <section className="screen stage-screen">
                <WorldIllustration world={currentWorld} mood="intro" />
                <div className="teacher-stack">
                  <TeacherGuide
                    title="Татьяна Николаевна"
                    message={currentWorld.teacherIntro}
                    tip={currentWorld.teacherTip}
                  />
                  <div className="teacher-card">
                    <div className="teacher-card__icon">ТН</div>
                    <div>
                      <p className="eyebrow">Татьяна Николаевна</p>
                      <h3>Добро пожаловать в мир {currentWorld.badge}</h3>
                      <p>{currentWorld.teacherIntro}</p>
                      <p className="teacher-card__tip">{currentWorld.teacherTip}</p>
                    </div>
                  </div>
                </div>
                <div className="cta-row">
                  <button className="primary-button" type="button" onClick={() => setScreen("learn")}>
                    Начать обучение
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setScreen("wheel")}>
                    Выбрать другой мир
                  </button>
                </div>
              </section>
            )}

            {screen === "learn" && (
              <LearningScreen
                world={currentWorld}
                card={currentWorld.learnCards[learningIndex]}
                cardIndex={learningIndex}
                total={currentWorld.learnCards.length}
                message={learningStates[learningIndex]}
                onChoice={handleLearningChoice}
                onReveal={handleReveal}
                onPrevious={() => setLearningIndex((current) => Math.max(0, current - 1))}
                onNext={() => {
                  if (learningIndex === currentWorld.learnCards.length - 1) {
                    setScreen("warmup");
                    return;
                  }
                  setLearningIndex((current) => Math.min(currentWorld.learnCards.length - 1, current + 1));
                }}
              />
            )}

            {screen === "warmup" && (
              <QuestionScreen
                world={currentWorld}
                title="Разминка"
                subtitle="Два простых примера без штрафа"
                helper={warmupMessage}
                question={warmupQuestions[warmupIndex]}
                index={warmupIndex}
                total={warmupQuestions.length}
                value={warmupInput}
                onChange={setWarmupInput}
                onSubmit={submitWarmup}
                onHint={useWarmupHint}
                buttonLabel={warmupIndex === warmupQuestions.length - 1 ? "К проверке" : "Дальше"}
                attempts={warmupAttempts}
                hintsUsed={warmupHintsUsed}
              />
            )}

            {screen === "quiz" && (
              <QuestionScreen
                world={currentWorld}
                title="Проверка"
                subtitle="Восемь примеров в случайном порядке"
                helper={quizMessage}
                question={quizQuestions[quizIndex]}
                index={quizIndex}
                total={quizQuestions.length}
                value={quizInput}
                onChange={setQuizInput}
                onSubmit={submitQuiz}
                onHint={useQuizHint}
                buttonLabel={quizIndex === quizQuestions.length - 1 ? "Завершить" : "Проверить"}
                score={quizCorrect}
                attempts={quizAttempts}
                hintsUsed={quizHintsUsed}
              />
            )}

            {screen === "result" && (
              <section className="screen result-screen">
                <div className={`medal-card medal-card--${resultMedal}`}>
                  <span className="medal-card__icon">{medalEmoji(resultMedal)}</span>
                  <p className="eyebrow">Результат уровня {currentWorld.badge}</p>
                  <h3>{medalLabel(resultMedal)}</h3>
                  <p>
                    Ты решил правильно {quizCorrect} из {quizQuestions.length}.
                  </p>
                  <p>Подсказок использовано: {quizHintsUsed}</p>
                  <p className="teacher-card__tip">
                    {resultMedal === "none"
                      ? "Почти получилось. Попробуй ещё раз, и медаль будет твоей."
                      : "Отлично! Татьяна Николаевна гордится твоей работой."}
                  </p>
                </div>
                <div className="cta-row">
                  <button className="primary-button" type="button" onClick={restartCurrentWorld}>
                    Играть ещё раз
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setScreen("medals")}>
                    Мои медали
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setScreen("wheel")}>
                    Новый мир
                  </button>
                </div>
              </section>
            )}

            {screen === "medals" && (
              <section className="screen medals-screen">
                <div className="panel">
                  <p className="eyebrow">Коллекция</p>
                  <h3>Мои медали</h3>
                  <p>
                    {learningRange === "short"
                      ? "Здесь показаны миры от ×2 до ×5 для текущего режима."
                      : "Здесь показаны все миры от ×2 до ×9."}
                  </p>
                </div>
                <div className="medal-grid">
                  {availableWorlds.map((world) => {
                    const medal = progress[world.multiplier] ?? "none";
                    return (
                      <article key={world.multiplier} className={`medal-tile medal-tile--${medal}`}>
                        <span className="medal-tile__icon">{medalEmoji(medal)}</span>
                        <strong>Мир {world.badge}</strong>
                        <span>{world.title}</span>
                        <small>{medalLabel(medal)}</small>
                      </article>
                    );
                  })}
                </div>
                <div className="cta-row">
                  <button className="primary-button" type="button" onClick={() => setScreen("wheel")}>
                    К новым приключениям
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setScreen("home")}>
                    На главную
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LearningScreen({
  world,
  card,
  cardIndex,
  total,
  message,
  onChoice,
  onReveal,
  onPrevious,
  onNext,
}: {
  world: WorldConfig;
  card: LearningCard;
  cardIndex: number;
  total: number;
  message?: string;
  onChoice: (cardIndex: number, correct: boolean, successText: string) => Promise<void>;
  onReveal: (cardIndex: number, answer: string) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const interaction = card.interaction;

  return (
    <section className="screen learning-screen">
      <WorldIllustration world={world} mood="learn" />
      <div className="panel learning-panel">
        <TeacherGuide
          compact
          title="Подсказка учителя"
          message={card.text}
          tip={card.hint}
        />
        <div className="progress-row">
          <span className="eyebrow">Обучение</span>
          <strong>
            Карточка {cardIndex + 1} / {total}
          </strong>
        </div>
        <h3>{card.title}</h3>
        <p>{card.text}</p>
        <p className="learning-panel__hint">{card.hint}</p>

        <div className="visual-grid">
          {card.visual.map((group, index) => (
            <div
              key={`${group.icon}-${index}`}
              className="visual-group"
              style={
                group.accent
                  ? ({ "--group-accent": group.accent } as CSSProperties)
                  : undefined
              }
            >
              <div className="visual-group__icons">
                {group.values.map((value, innerIndex) => (
                  <span key={`${value}-${innerIndex}`}>
                    {value > 0 ? `${group.icon}${value}` : `${value}`}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {interaction?.type === "choice" && (
          <div className="interaction-box">
            <strong>{interaction.prompt}</strong>
            <div className="choice-row">
              {interaction.options.map((option) => (
                <button
                  key={option}
                  className="choice-button"
                  type="button"
                  onClick={() => void onChoice(cardIndex, option === interaction.correct, interaction.successText)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {interaction?.type === "reveal" && (
          <div className="interaction-box">
            <strong>{interaction.prompt}</strong>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onReveal(cardIndex, interaction.answer)}
            >
              {interaction.buttonLabel}
            </button>
          </div>
        )}

        {message && <div className="feedback-chip">{message}</div>}

        <div className="cta-row">
          <button className="secondary-button" type="button" onClick={onPrevious} disabled={cardIndex === 0}>
            Назад
          </button>
          <button className="primary-button" type="button" onClick={onNext}>
            {cardIndex === total - 1 ? "К разминке" : "Дальше"}
          </button>
        </div>
      </div>
    </section>
  );
}

function QuestionScreen({
  world,
  title,
  subtitle,
  helper,
  question,
  index,
  total,
  value,
  onChange,
  onSubmit,
  onHint,
  buttonLabel,
  score,
  attempts,
  hintsUsed,
}: {
  world: WorldConfig;
  title: string;
  subtitle: string;
  helper: string;
  question?: QuizQuestion;
  index: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  onHint: () => void;
  buttonLabel: string;
  score?: number;
  attempts?: number;
  hintsUsed?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [index, question?.answer]);

  return (
    <section className="screen question-screen">
      <WorldIllustration world={world} mood="challenge" />
      <div className="panel question-panel">
        <TeacherGuide
          compact
          title="Татьяна Николаевна"
          message={helper}
          tip={title === "Проверка" ? "Если ошибёшься три раза, я покажу правильный ответ." : "Это безопасная разминка, здесь можно пробовать."}
        />
        <div className="progress-row">
          <span className="eyebrow">{title}</span>
          <strong>
            {index + 1} / {total}
          </strong>
        </div>
        <h3>{subtitle}</h3>
        <p>{helper}</p>
        {typeof score === "number" && <div className="score-chip">Правильно: {score}</div>}
        {typeof attempts === "number" && (
          <div className="feedback-chip">Ошибок в этом примере: {attempts} из 3</div>
        )}
        {typeof hintsUsed === "number" && (
          <div className="feedback-chip">Подсказок использовано: {hintsUsed}</div>
        )}
        {question && (
          <div className="sum-card">
            <span>{question.multiplier}</span>
            <strong>×</strong>
            <span>{question.factor}</span>
            <strong>=</strong>
            <span>?</span>
          </div>
        )}
        <label className="answer-field">
          <span>Ответ</span>
          <input
            ref={inputRef}
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onSubmit();
              }
            }}
          />
        </label>
        <div className="cta-row cta-row--center">
          {typeof attempts === "number" && attempts >= 1 && (
            <button className="secondary-button" type="button" onClick={onHint}>
              Подсказка
            </button>
          )}
          <button className="primary-button" type="button" onClick={() => void onSubmit()} disabled={!value}>
            {buttonLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function quizOrWarmupValue(value: string) {
  return value.trim() === "" ? "-1" : value.trim();
}

function FeedbackOverlay({ type }: { type: "success" | "error" }) {
  const particles = Array.from({ length: type === "success" ? 16 : 10 });

  return (
    <div className={`feedback-overlay feedback-overlay--${type}`} aria-hidden="true">
      {particles.map((_, index) => (
        <span
          key={`${type}-${index}`}
          className="feedback-overlay__particle"
          style={
            {
              "--particle-x": `${(index % 4) * 18 - 24}px`,
              "--particle-y": `${Math.floor(index / 4) * 12 - 18}px`,
            } as CSSProperties
          }
        />
      ))}
      <div className="feedback-overlay__label">{type === "success" ? "Правильно!" : "Ой!"}</div>
    </div>
  );
}

function WorldIllustration({
  world,
  mood,
}: {
  world: WorldConfig;
  mood: "intro" | "learn" | "challenge";
}) {
  const characters = {
    2: { hero: "🧒", buddy: "🧒", detail: "🫧" },
    3: { hero: "🏝️", buddy: "🦜", detail: "🌊" },
    4: { hero: "🏙️", buddy: "🤖", detail: "🧱" },
    5: { hero: "🚂", buddy: "🙂", detail: "☁️" },
    6: { hero: "🐠", buddy: "🪸", detail: "🫧" },
    7: { hero: "🧑‍🚀", buddy: "🪐", detail: "✨" },
    8: { hero: "🦜", buddy: "🐒", detail: "🌿" },
    9: { hero: "🏰", buddy: "🛡️", detail: "⭐" },
  }[world.multiplier] ?? { hero: "🎮", buddy: "✨", detail: "⭐" };

  return (
    <div className={`illustration-card illustration-card--${mood} illustration-card--world-${world.multiplier}`}>
      <div className="illustration-card__glow" />
      <div className="illustration-card__sky" />
      <div className="illustration-card__backdrop" />
      <div className="illustration-card__terrain illustration-card__terrain--back" />
      <div className="illustration-card__terrain illustration-card__terrain--mid" />
      <div className="illustration-card__hero">{characters.hero}</div>
      <div className="illustration-card__buddy">{characters.buddy}</div>
      <div className="illustration-card__detail illustration-card__detail--a">{characters.detail}</div>
      <div className="illustration-card__detail illustration-card__detail--b">{characters.detail}</div>
      <div className="illustration-card__tokens">
        <span className="illustration-card__token">{world.badge}</span>
        <span className="illustration-card__token">{world.biome}</span>
      </div>
      <div className="illustration-card__spark illustration-card__spark--1" />
      <div className="illustration-card__spark illustration-card__spark--2" />
      <div className="illustration-card__spark illustration-card__spark--3" />
      <div className="illustration-card__ground" />
      <div className="illustration-card__speech">
        {mood === "intro"
          ? world.subtitle
          : mood === "learn"
            ? "Смотри на подсказки и картинки"
            : "Решай пример и следи за эффектами"}
      </div>
    </div>
  );
}

function TeacherGuide({
  title,
  message,
  tip,
  compact = false,
}: {
  title: string;
  message: string;
  tip?: string;
  compact?: boolean;
}) {
  return (
    <div className={`teacher-guide ${compact ? "teacher-guide--compact" : ""}`}>
      <div className="teacher-guide__avatar" aria-hidden="true">
        <span className="teacher-guide__backhair" />
        <span className="teacher-guide__face" />
        <span className="teacher-guide__fringe" />
        <span className="teacher-guide__eye teacher-guide__eye--left" />
        <span className="teacher-guide__eye teacher-guide__eye--right" />
        <span className="teacher-guide__smile" />
        <span className="teacher-guide__neck" />
        <span className="teacher-guide__body" />
        <span className="teacher-guide__shine" />
      </div>
      <div className="teacher-guide__bubble">
        <p className="eyebrow">{title}</p>
        <strong>{message}</strong>
        {tip && <span className="teacher-guide__tip">{tip}</span>}
      </div>
    </div>
  );
}

export default App;
