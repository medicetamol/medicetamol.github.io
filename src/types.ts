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
