import type { Exam, PYQQuestion } from "../types";
import { EXAMS } from "../constants";
import { loadQuestions } from "./questions";
import manifest from "./manifest.json";

type Manifest = Record<string, Record<string, { total: number; topics: Record<string, number> }>>;

// Simple deterministic hash → same seed produces the same pick every time,
// so every visitor sees the same "PYQ of the day" for a given date.
function seedFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickWeighted(seed: number, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let target = seed % total;
  for (let i = 0; i < weights.length; i++) {
    if (target < weights[i]) return i;
    target -= weights[i];
  }
  return weights.length - 1;
}

/**
 * Returns the same question for every visitor on a given calendar date,
 * picked (weighted by question count) from the manifest so no full dataset
 * scan is needed, then loaded lazily from just that one subject's file.
 */
export async function getDailyQuestion(): Promise<PYQQuestion | undefined> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const data = manifest as Manifest;

  type Entry = { exam: Exam; subjectId: string; total: number };
  const entries: Entry[] = [];
  for (const exam of EXAMS.map((e) => e.id)) {
    const subjects = data[exam] ?? {};
    for (const subjectId of Object.keys(subjects)) {
      const total = subjects[subjectId]?.total ?? 0;
      if (total > 0) entries.push({ exam, subjectId, total });
    }
  }
  if (entries.length === 0) return undefined;

  const seed = seedFromString(dateKey);
  const subjectIndex = pickWeighted(seed, entries.map((e) => e.total));
  const chosen = entries[subjectIndex];

  const questions = await loadQuestions(chosen.exam, chosen.subjectId);
  if (questions.length === 0) return undefined;

  // Different derived seed for the in-subject pick, so it doesn't always land on index 0.
  const questionIndex = seedFromString(dateKey + chosen.subjectId) % questions.length;
  return questions[questionIndex];
}
