export type MedalTier = "none" | "bronze" | "silver" | "gold";

export type GameScreen =
  | "splash"
  | "home"
  | "wheel"
  | "intro"
  | "learn"
  | "warmup"
  | "quiz"
  | "result"
  | "medals";

export type ProgressState = Record<number, MedalTier>;

export interface AudioSettings {
  enabled: boolean;
  musicStarted: boolean;
}

export interface VisualGroup {
  icon: string;
  values: number[];
  accent?: string;
}

export interface ChoiceInteraction {
  type: "choice";
  prompt: string;
  options: number[];
  correct: number;
  successText: string;
}

export interface RevealInteraction {
  type: "reveal";
  prompt: string;
  answer: string;
  buttonLabel: string;
}

export type LearningInteraction = ChoiceInteraction | RevealInteraction;

export interface LearningCard {
  title: string;
  text: string;
  hint: string;
  visual: VisualGroup[];
  interaction?: LearningInteraction;
}

export interface QuizQuestion {
  multiplier: number;
  factor: number;
  answer: number;
}

export interface WorldConfig {
  multiplier: number;
  title: string;
  subtitle: string;
  biome: string;
  teacherIntro: string;
  teacherTip: string;
  accent: string;
  accentSoft: string;
  accentStrong: string;
  background: string;
  badge: string;
  scenery: string[];
  learnCards: LearningCard[];
  warmupFactors: number[];
  quizFactors: number[];
}
