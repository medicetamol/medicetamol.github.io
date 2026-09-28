import type {
  Bookmark,
  CustomModuleHistoryEntry,
  DailyActivity,
  LifetimeStats,
  QuestionAnswer,
} from "../types";
import type { LocalSnapshot } from "./db";

/**
 * Shape of users/{uid}/data/progress in Firestore. One document per user.
 *
 * answers: exam code -> subject code -> { correct: ["002", ...], incorrect: { "005": 3 } }
 *   The exam and subject prefixes of a qid are implied by the nesting, so only
 *   the 3-digit serial is stored (kept as a string so no padding is ever needed).
 * bookmark: full qids (bookmarks are cross-exam and cleared separately).
 * activity: date -> { c: correct, i: incorrect }
 */
export interface CloudProgress {
  answers: Record<string, Record<string, { correct: string[]; incorrect: Record<string, number> }>>;
  bookmark: string[];
  activity: Record<string, { c: number; i: number }>;
  lifetime: { totalSolved: number; totalCorrect: number };
  modules: CustomModuleHistoryEntry[];
  updatedAt: number;
}

// qid = {2 letters exam}{2 letters subject}{3 digits}
const QID_RE = /^([A-Z]{2})([A-Z]{2})(\d{3})$/;

export function encodeSnapshot(s: LocalSnapshot): CloudProgress {
  const answers: CloudProgress["answers"] = {};
  for (const a of s.answers) {
    const m = QID_RE.exec(a.qid);
    if (!m) continue; // never write something we couldn't decode back
    const [, exam, subject, serial] = m;
    const bucket = ((answers[exam] ??= {})[subject] ??= { correct: [], incorrect: {} });
    if (a.incorrect === undefined) bucket.correct.push(serial);
    else bucket.incorrect[serial] = a.incorrect;
  }

  const activity: CloudProgress["activity"] = {};
  for (const d of s.activity) activity[d.date] = { c: d.correct, i: d.incorrect };

  return {
    answers,
    bookmark: s.bookmarks.map((b) => b.qid),
    activity,
    lifetime: { totalSolved: s.lifetime.totalSolved, totalCorrect: s.lifetime.totalCorrect },
    modules: s.modules,
    updatedAt: Date.now(),
  };
}

export function decodeSnapshot(c: Partial<CloudProgress>): LocalSnapshot {
  const answers: QuestionAnswer[] = [];
  for (const [exam, subjects] of Object.entries(c.answers ?? {})) {
    for (const [subject, bucket] of Object.entries(subjects ?? {})) {
      for (const serial of bucket?.correct ?? []) {
        answers.push({ qid: `${exam}${subject}${serial}` });
      }
      for (const [serial, selected] of Object.entries(bucket?.incorrect ?? {})) {
        answers.push({ qid: `${exam}${subject}${serial}`, incorrect: selected });
      }
    }
  }

  const activity: DailyActivity[] = Object.entries(c.activity ?? {}).map(([date, v]) => ({
    date,
    correct: v.c,
    incorrect: v.i,
  }));

  const lifetime: LifetimeStats = {
    id: "lifetime",
    totalSolved: c.lifetime?.totalSolved ?? 0,
    totalCorrect: c.lifetime?.totalCorrect ?? 0,
  };

  const bookmarks: Bookmark[] = (c.bookmark ?? []).map((qid) => ({ qid }));

  return { answers, bookmarks, activity, lifetime, modules: c.modules ?? [] };
}
