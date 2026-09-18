import type { Bookmark, DailyActivity, LifetimeStats, QuestionAnswer, QuizResult } from "../types";

const DB_NAME = "medicetamol-db";
const DB_VERSION = 4;
const BOOKMARKS = "bookmarks";
const ANSWERS = "answers";
const ACTIVITY = "dailyActivity";
const LIFETIME = "lifetimeStats";
const QUIZZES = "quizResults";
// v2 store name, only used during migration
const LEGACY_PROGRESS = "questionProgress";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      const transaction = req.transaction;

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
      if (!db.objectStoreNames.contains(QUIZZES)) {
        const store = db.createObjectStore(QUIZZES, { keyPath: "finishedAt" });
        store.createIndex("startedAt", "startedAt");
      }

      // Migrate v2 questionProgress rows into the new bookmarks/answers stores,
      // then drop the legacy store. Preserves existing user data on upgrade.
      if (oldVersion < 3 && db.objectStoreNames.contains(LEGACY_PROGRESS) && transaction) {
        const legacyStore = transaction.objectStore(LEGACY_PROGRESS);
        const bookmarksStore = transaction.objectStore(BOOKMARKS);
        const answersStore = transaction.objectStore(ANSWERS);

        legacyStore.getAll().onsuccess = (e) => {
          const rows = (e.target as IDBRequest).result as Array<{
            qid: string;
            bookmarked?: boolean;
            attempts?: number;
            directCorrect?: boolean;
          }>;
          for (const row of rows) {
            if (row.bookmarked) {
              bookmarksStore.put({ qid: row.qid } satisfies Bookmark);
            }
            if ((row.attempts ?? 0) > 0) {
              // We don't know the exact wrong option from legacy data, so a
              // previously-incorrect question migrates as answered-correct.
              // This only affects historical resume-highlight styling, not counts going forward.
              answersStore.put({ qid: row.qid } satisfies QuestionAnswer);
            }
          }
        };

        db.deleteObjectStore(LEGACY_PROGRESS);
      }

      // Seed lifetime totals once, from whatever dailyActivity already exists,
      // so upgrading users don't start back at 0.
      if (oldVersion < 4 && db.objectStoreNames.contains(ACTIVITY) && transaction) {
        const activityStore = transaction.objectStore(ACTIVITY);
        const lifetimeStore = transaction.objectStore(LIFETIME);
        activityStore.getAll().onsuccess = (e) => {
          const rows = (e.target as IDBRequest).result as DailyActivity[];
          const totalSolved = rows.reduce((n, r) => n + r.correct + r.incorrect, 0);
          const totalCorrect = rows.reduce((n, r) => n + r.correct, 0);
          if (totalSolved > 0) {
            lifetimeStore.put({ id: "lifetime", totalSolved, totalCorrect } satisfies LifetimeStats);
          }
        };
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
  const date = new Date().toISOString().slice(0, 10);
  const current = await tx<DailyActivity | null>(ACTIVITY, "readonly", (store, resolve, reject) => {
    const req = store.get(date);
    req.onsuccess = () => resolve((req.result as DailyActivity | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });

  const next: DailyActivity = current ?? { date, correct: 0, incorrect: 0 };
  if (correct) next.correct += 1;
  else next.incorrect += 1;

  await tx<void>(ACTIVITY, "readwrite", (store, resolve) => {
    store.put(next);
    resolve();
  });

  await bumpLifetimeStats(correct);
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

async function bumpLifetimeStats(correct: boolean): Promise<void> {
  const current = await tx<LifetimeStats | null>(LIFETIME, "readonly", (store, resolve, reject) => {
    const req = store.get("lifetime");
    req.onsuccess = () => resolve((req.result as LifetimeStats | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });

  const next: LifetimeStats = current ?? { id: "lifetime", totalSolved: 0, totalCorrect: 0 };
  next.totalSolved += 1;
  if (correct) next.totalCorrect += 1;

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
 * correct+incorrect >= STREAK_DAILY_GOAL. Today is never a hard break by
 * itself — if today hasn't hit the goal yet, the streak still shows
 * yesterday's count (dimmed, at risk) rather than resetting to 0. The streak
 * only resets when a full past day is found that didn't hit the goal.
 */
export function computeStreak(activity: DailyActivity[]): StreakInfo {
  const byDate = new Map(activity.map((a) => [a.date, a]));
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = byDate.get(todayKey);
  const todayCount = (today?.correct ?? 0) + (today?.incorrect ?? 0);
  const completedToday = todayCount >= STREAK_DAILY_GOAL;

  let days = 0;
  const cursor = new Date();
  // Start counting from today only if it already qualifies; otherwise start
  // from yesterday, so an in-progress today doesn't break the streak early.
  if (!completedToday) cursor.setDate(cursor.getDate() - 1);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const row = byDate.get(key);
    const count = (row?.correct ?? 0) + (row?.incorrect ?? 0);
    if (count < STREAK_DAILY_GOAL) break;
    days++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { days, completedToday, todayCount };
}

// ─── Quiz results ────────────────────────────────────────────────────────────

export async function saveQuizResult(result: QuizResult): Promise<void> {
  return tx<void>(QUIZZES, "readwrite", (store, resolve) => {
    store.put(result);
    resolve();
  });
}

export async function getQuizResults(): Promise<QuizResult[]> {
  return tx<QuizResult[]>(QUIZZES, "readonly", (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as QuizResult[]);
    req.onerror = () => reject(req.error);
  });
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
