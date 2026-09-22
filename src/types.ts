export type Exam = "NEET-PG" | "INI-CET" | "FMGE";
export type StatusFilter = "all" | "incorrect" | "correct" | "bookmark";

export interface Topic {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  short: string;
  topics: Topic[];
}

export interface PYQQuestion {
  id: string;
  exam: Exam;
  year: number;
  subjectId: string;
  topicId: string;
  topicName?: string;
  question: string;
  options: string[];
  answer: number;
  image?: string;
}

export interface PYQExplanation {
  id: string;
  e: string;
}

export interface Bookmark {
  qid: string;
}

export interface QuestionAnswer {
  qid: string;
  /** Present only when the attempt was wrong: the option index the user picked. */
  incorrect?: number;
}

export interface QuizAnswer {
  qid: string;
  selected: number | null;
  correct: boolean;
}

export interface QuizResult {
  exam: Exam;
  questionIds: string[];
  answers: QuizAnswer[];
  customModule: boolean;
  startedAt: string;
  finishedAt: string;
}

/**
 * Capped (last 10) history of custom-module attempts, separate from
 * QuizResult (which is uncapped and covers every quiz mode). Only the most
 * recent entry is resumable, and only within RESUME_WINDOW_MS of startedAt.
 * questionIds/answers are parallel arrays (index i's answer is for
 * questionIds[i]) — no per-question timestamps, just the one startedAt.
 */
export interface CustomModuleHistoryEntry {
  id: string; // startedAt is unique enough within one session's module starts
  exam: Exam;
  mode: "quiz" | "guide";
  startedAt: string;
  finishedAt: string | null; // null while still resumable/in-progress
  subjectLabel: string; // e.g. "Anatomy, Biochem, Physio" or "All subjects" — display-only, computed once at save time
  questionIds: string[];
  answers: (number | null)[]; // parallel to questionIds; null = skipped
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
}

export interface DailyActivity {
  date: string;
  correct: number;
  incorrect: number;
}

/**
 * Single running lifetime counter, independent of dailyActivity (which will
 * eventually be pruned to ~2 weeks) and answers (cleared per-subject). Never
 * decreases — the one number on Progress that survives every kind of clear.
 */
export interface LifetimeStats {
  id: "lifetime";
  totalSolved: number;
  totalCorrect: number;
}
