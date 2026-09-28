import type { Bookmark, CustomModuleHistoryEntry, DailyActivity, LifetimeStats, QuestionAnswer } from "../types";

const DB_NAME = "medicetamol-db";
const DB_VERSION = 6;
const BOOKMARKS = "bookmarks";
const ANSWERS = "answers";
const ACTIVITY = "dailyActivity";
const LIFETIME = "lifetimeStats";
const MODULE_HISTORY = "customModuleHistory";
// v5 store, unused (no code ever read from it) — dropped in v6.
const LEGACY_QUIZZES = "quizResults";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(BOOKMARKS)) {
        db.createObjectStore(BOOKMARKS, { keyPath: "qid" });
      }
      if (!db.objectStoreNames.contains(ANSWERS)) {
        db.createObjectStore(ANSWERS, { keyPath: "qid" });
      }
      if (!db.objectStoreNames.contains(ACTIVITY)) {
        db.createObjectStore(ACTIVITY, { keyPath: "date" });
      }
      if (!db.objectStoreNames.contains(LIFETIME)) {
        db.createObjectStore(LIFETIME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(MODULE_HISTORY)) {
        const store = db.createObjectStore(MODULE_HISTORY, { keyPath: "id" });
        store.createIndex("startedAt", "startedAt");
      }
      if (db.objectStoreNames.contains(LEGACY_QUIZZES)) {
        db.deleteObjectStore(LEGACY_QUIZZES);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  return openDB().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    action(transaction.objectStore(storeName), resolve, reject);
    transaction.onerror = () => reject(transaction.error);
  }));
}

// ─── Bookmarks ────────────────────────────────────────────────────────────

export async function isBookmarked(qid: string): Promise<boolean> {
  return tx<boolean>(BOOKMARKS, "readonly", (store, resolve, reject) => {
    const req = store.get(qid);
    req.onsuccess = () => resolve(Boolean(req.result));
    req.onerror = () => reject(req.error);
  });
}

export async function getAllBookmarks(): Promise<Bookmark[]> {
  return tx<Bookmark[]>(BOOKMARKS, "readonly", (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as Bookmark[]);
    req.onerror = () => reject(req.error);
  });
}

export async function toggleBookmark(qid: string): Promise<{ bookmarked: boolean }> {
  const wasBookmarked = await isBookmarked(qid);
  await tx<void>(BOOKMARKS, "readwrite", (store, resolve) => {
    if (wasBookmarked) store.delete(qid);
    else store.put({ qid } satisfies Bookmark);
    resolve();
  });
  return { bookmarked: !wasBookmarked };
}

// ─── Answers (Direct QBank only) ────────────────────────────────────────────

export async function getQuestionAnswer(qid: string): Promise<QuestionAnswer | null> {
  return tx<QuestionAnswer | null>(ANSWERS, "readonly", (store, resolve, reject) => {
    const req = store.get(qid);
    req.onsuccess = () => resolve((req.result as QuestionAnswer | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllAnswers(): Promise<QuestionAnswer[]> {
  return tx<QuestionAnswer[]>(ANSWERS, "readonly", (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as QuestionAnswer[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Direct QBank attempt only. A question can be answered once; re-visiting an
 * already-answered question restores it read-only (see Quiz.tsx). `selected`
 * is the chosen option index — stored only when wrong, so the resume view can
 * highlight the exact wrong option picked. Does NOT record daily activity —
 * callers record that separately (see recordDailyActivity), since activity is
 * tracked for every mode (Direct, custom module, bookmark quiz), not just Direct.
 */
export async function recordDirectAnswer(qid: string, correct: boolean, selected: number | null): Promise<QuestionAnswer> {
  const record: QuestionAnswer = correct || selected === null
    ? { qid }
    : { qid, incorrect: selected };

  await tx<void>(ANSWERS, "readwrite", (store, resolve) => {
    store.put(record);
    resolve();
  });
  return record;
}

// ─── Daily activity (all modes: Direct QBank, custom modules, bookmark quiz) ─
// Only actually-attempted questions count (a skipped/timed-out submission,
// selected === null, should never reach this — see call sites in Quiz.tsx /
// BookmarkQuiz.tsx). Powers both the weekly chart and the streak.

/** Minimum questions solved in a day for that day to count toward the streak. */
export const STREAK_DAILY_GOAL = 5;

export async function recordDailyActivity(correct: boolean): Promise<void> {
  return recordDailyActivityBatch(correct ? 1 : 0, 1);
}

// Folds N solved questions (correctCount of them correct) into a single
// read-modify-write on the day's row and lifetimeStats, instead of one
// round trip per question. Use this whenever crediting more than one
// question at once (e.g. a whole finished quiz-mode module).
export async function recordDailyActivityBatch(correctCount: number, totalCount: number): Promise<void> {
  if (totalCount === 0) return;

  const date = new Date().toISOString().slice(0, 10);
  const current = await tx<DailyActivity | null>(ACTIVITY, "readonly", (store, resolve, reject) => {
    const req = store.get(date);
    req.onsuccess = () => resolve((req.result as DailyActivity | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });

  const next: DailyActivity = current ?? { date, correct: 0, incorrect: 0 };
  next.correct += correctCount;
  next.incorrect += totalCount - correctCount;

  await tx<void>(ACTIVITY, "readwrite", (store, resolve) => {
    store.put(next);
    resolve();
  });

  await bumpLifetimeStatsBatch(correctCount, totalCount);
}

export async function getDailyActivity(): Promise<DailyActivity[]> {
  return tx<DailyActivity[]>(ACTIVITY, "readonly", (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as DailyActivity[]);
    req.onerror = () => reject(req.error);
  });
}

// ─── Lifetime stats (never decreases, survives subject-clear and any future
// dailyActivity pruning) ────────────────────────────────────────────────────

async function bumpLifetimeStatsBatch(correctCount: number, totalCount: number): Promise<void> {
  const current = await tx<LifetimeStats | null>(LIFETIME, "readonly", (store, resolve, reject) => {
    const req = store.get("lifetime");
    req.onsuccess = () => resolve((req.result as LifetimeStats | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });

  const next: LifetimeStats = current ?? { id: "lifetime", totalSolved: 0, totalCorrect: 0 };
  next.totalSolved += totalCount;
  next.totalCorrect += correctCount;

  await tx<void>(LIFETIME, "readwrite", (store, resolve) => {
    store.put(next);
    resolve();
  });
}

export async function getLifetimeStats(): Promise<LifetimeStats> {
  return tx<LifetimeStats>(LIFETIME, "readonly", (store, resolve, reject) => {
    const req = store.get("lifetime");
    req.onsuccess = () => {
      resolve((req.result as LifetimeStats | undefined) ?? { id: "lifetime", totalSolved: 0, totalCorrect: 0 });
    };
    req.onerror = () => reject(req.error);
  });
}

export interface StreakInfo {
  /** Consecutive qualifying days, counting backward from the most recent qualifying/pending day. */
  days: number;
  /** True once today has hit the daily goal (icon should be lit). */
  completedToday: boolean;
  /** Today's progress toward the daily goal, e.g. 3 of 5. */
  todayCount: number;
}

/**
 * Computes the current streak from daily activity. A day "counts" once
 * count >= STREAK_DAILY_GOAL. Today is never a hard break by
 * itself — if today hasn't hit the goal yet, the streak still shows
 * yesterday's count (dimmed, at risk) rather than resetting to 0. The streak
 * only resets when a full past day is found that didn't hit the goal.
 */
export function computeStreak(activity: DailyActivity[]): StreakInfo {
  const byDate = new Map(activity.map((a) => [a.date, a]));
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = byDate.get(todayKey);
  const todayCount = today ? today.correct + today.incorrect : 0;
  const completedToday = todayCount >= STREAK_DAILY_GOAL;

  let days = 0;
  const cursor = new Date();
  // Start counting from today only if it already qualifies; otherwise start
  // from yesterday, so an in-progress today doesn't break the streak early.
  if (!completedToday) cursor.setDate(cursor.getDate() - 1);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const row = byDate.get(key);
    const count = row ? row.correct + row.incorrect : 0;
    if (count < STREAK_DAILY_GOAL) break;
    days++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { days, completedToday, todayCount };
}

/**
 * Clear all Direct QBank answers for a set of question IDs belonging to a
 * subject. Bookmarks are a separate store and are intentionally untouched.
 * Called from Progress.tsx when the user double-taps and confirms a subject wipe.
 */
export async function clearSubjectProgress(qids: string[]): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(ANSWERS, "readwrite");
        const store = transaction.objectStore(ANSWERS);
        let pending = qids.length;
        if (pending === 0) { resolve(); return; }
        for (const qid of qids) {
          const req = store.delete(qid);
          req.onsuccess = () => { pending--; if (pending === 0) resolve(); };
          req.onerror = () => reject(req.error);
        }
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

// ─── Custom module history (last 10, capped) ────────────────────────────────
// Separate from quizResults (uncapped, covers every mode). Only the single
// most-recent entry is ever resumable, and only within RESUME_WINDOW_MS.

export const CUSTOM_MODULE_HISTORY_CAP = 10;
export const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function saveCustomModuleHistory(entry: CustomModuleHistoryEntry): Promise<void> {
  await tx<void>(MODULE_HISTORY, "readwrite", (store, resolve) => {
    store.put(entry);
    resolve();
  });
  await pruneCustomModuleHistory();
}

export async function getCustomModuleHistory(): Promise<CustomModuleHistoryEntry[]> {
  const rows = await tx<CustomModuleHistoryEntry[]>(MODULE_HISTORY, "readonly", (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as CustomModuleHistoryEntry[]);
    req.onerror = () => reject(req.error);
  });
  // Newest first
  return rows.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export async function getCustomModuleHistoryEntry(id: string): Promise<CustomModuleHistoryEntry | null> {
  return tx<CustomModuleHistoryEntry | null>(MODULE_HISTORY, "readonly", (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as CustomModuleHistoryEntry | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Keep only the CUSTOM_MODULE_HISTORY_CAP most recent entries; delete the rest.
 * Called after every save so the store never grows unbounded (keeps IndexedDB
 * reads/writes fast and the Solved Modules page light).
 */
async function pruneCustomModuleHistory(): Promise<void> {
  const all = await getCustomModuleHistory(); // newest first
  const toDelete = all.slice(CUSTOM_MODULE_HISTORY_CAP);
  if (toDelete.length === 0) return;
  await openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(MODULE_HISTORY, "readwrite");
        const store = transaction.objectStore(MODULE_HISTORY);
        let pending = toDelete.length;
        for (const entry of toDelete) {
          const req = store.delete(entry.id);
          req.onsuccess = () => { pending--; if (pending === 0) resolve(); };
          req.onerror = () => reject(req.error);
        }
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

// ─── Bulk helpers for cloud sync (see syncEngine.ts) ────────────────────────
// Sync reads whole stores and, on download, replaces them wholesale.

/** Everything the cloud copy is built from, read in one go. */
export interface LocalSnapshot {
  answers: QuestionAnswer[];
  bookmarks: Bookmark[];
  activity: DailyActivity[];
  lifetime: LifetimeStats;
  modules: CustomModuleHistoryEntry[];
}

export async function getLocalSnapshot(): Promise<LocalSnapshot> {
  const [answers, bookmarks, activity, lifetime, modules] = await Promise.all([
    getAllAnswers(),
    getAllBookmarks(),
    getDailyActivity(),
    getLifetimeStats(),
    getCustomModuleHistory(),
  ]);
  // Only finished modules sync — an unfinished one is a local-only resumable draft.
  return { answers, bookmarks, activity, lifetime, modules: modules.filter((m) => m.finishedAt !== null) };
}

/** True when the device holds no progress at all. */
export function isSnapshotEmpty(s: LocalSnapshot): boolean {
  return (
    s.answers.length === 0 &&
    s.bookmarks.length === 0 &&
    s.activity.length === 0 &&
    s.lifetime.totalSolved === 0 &&
    s.modules.length === 0
  );
}

/** Wipe every store. Used on sign-out and before filling from the cloud. */
export async function clearAllLocalData(): Promise<void> {
  const db = await openDB();
  const names = [BOOKMARKS, ANSWERS, ACTIVITY, LIFETIME, MODULE_HISTORY];
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(names, "readwrite");
    for (const name of names) transaction.objectStore(name).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Replace all local data with a snapshot (clears first, then fills, atomically). */
export async function replaceLocalData(s: LocalSnapshot): Promise<void> {
  const db = await openDB();
  const names = [BOOKMARKS, ANSWERS, ACTIVITY, LIFETIME, MODULE_HISTORY];
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(names, "readwrite");
    for (const name of names) transaction.objectStore(name).clear();
    for (const b of s.bookmarks) transaction.objectStore(BOOKMARKS).put(b);
    for (const a of s.answers) transaction.objectStore(ANSWERS).put(a);
    for (const d of s.activity) transaction.objectStore(ACTIVITY).put(d);
    if (s.lifetime.totalSolved > 0) transaction.objectStore(LIFETIME).put(s.lifetime);
    for (const m of s.modules) transaction.objectStore(MODULE_HISTORY).put(m);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
