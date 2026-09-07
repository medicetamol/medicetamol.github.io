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

export interface QuestionProgress {
  qid: string;
  bookmarked: boolean;
  directCorrect: boolean;
  directIncorrect: boolean;
  firstIncorrect: boolean;
  attempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  lastAnsweredAt?: string;
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
  questions: number;
  correct: number;
  incorrect: number;
}
