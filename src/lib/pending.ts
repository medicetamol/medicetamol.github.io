/**
 * Pending changes since the last successful cloud sync, kept in localStorage.
 *
 * IndexedDB stays the full, always-current local state. Every mutation writes
 * IndexedDB first and then records itself here, so this log is only a copy of
 * "what's new". Pushing it uses field-level Firestore writes (arrayUnion,
 * increment), so one device can never overwrite another device's progress.
 *
 * The log is cleared only after a push succeeds. If a push fails, it just
 * keeps accumulating and the next attempt carries everything.
 */

const KEY = "medicetamol:pending";

// qid = {2 letters exam}{2 letters subject}{3 digits}
const QID_RE = /^([A-Z]{2})([A-Z]{2})(\d{3})$/;

export interface PendingBucket {
  correct: string[];
  incorrect: Record<string, number>;
}

export interface Pending {
  /** exam -> subject -> new answers (3-digit serials) */
  answers: Record<string, Record<string, PendingBucket>>;
  bookmarkAdd: string[];
  bookmarkRemove: string[];
  /** date -> increments (not totals) */
  activity: Record<string, { c: number; i: number }>;
  lifetime: { solved: number; correct: number };
  /** subject clears not yet pushed: "PG.AN" -> clearedAt (ms) */
  cleared: Record<string, number>;
  /** a finished custom module was saved since the last push */
  modulesDirty: boolean;
  /** ms timestamp of the last successful push (or download) */
  lastSync: number | null;
}

const empty = (): Pending => ({
  answers: {},
  bookmarkAdd: [],
  bookmarkRemove: [],
  activity: {},
  lifetime: { solved: 0, correct: 0 },
  cleared: {},
  modulesDirty: false,
  lastSync: null,
});

export function loadPending(): Pending {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...(JSON.parse(raw) as Partial<Pending>) };
  } catch {
    return empty();
  }
}

function save(p: Pending) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage full or unavailable: the change is still in IndexedDB and the
    // next full sync (sign-out / first sign-in) will carry it.
  }
  notify();
}

// ─── Subscribers (drive the sync button / status line) ──────────────────────

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribePending(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** True when there's anything worth pushing. */
export function hasPending(p: Pending = loadPending()): boolean {
  return (
    Object.keys(p.answers).length > 0 ||
    p.bookmarkAdd.length > 0 ||
    p.bookmarkRemove.length > 0 ||
    Object.keys(p.activity).length > 0 ||
    p.lifetime.solved > 0 ||
    Object.keys(p.cleared).length > 0 ||
    p.modulesDirty
  );
}

// ─── Recorders (called from db.ts right after the IndexedDB write) ──────────

export function recordAnswerPending(qid: string, incorrect: number | undefined) {
  const m = QID_RE.exec(qid);
  if (!m) return;
  const [, exam, subject, serial] = m;
  const p = loadPending();
  const bucket = ((p.answers[exam] ??= {})[subject] ??= { correct: [], incorrect: {} });
  if (incorrect === undefined) {
    if (!bucket.correct.includes(serial)) bucket.correct.push(serial);
  } else {
    bucket.incorrect[serial] = incorrect;
  }
  save(p);
}

export function recordBookmarkPending(qid: string, bookmarked: boolean) {
  const p = loadPending();
  const add = new Set(p.bookmarkAdd);
  const remove = new Set(p.bookmarkRemove);
  if (bookmarked) {
    // Re-adding something queued for removal cancels out.
    if (!remove.delete(qid)) add.add(qid);
  } else if (!add.delete(qid)) {
    remove.add(qid);
  }
  p.bookmarkAdd = [...add];
  p.bookmarkRemove = [...remove];
  save(p);
}

export function recordActivityPending(date: string, correctCount: number, totalCount: number) {
  const p = loadPending();
  const day = (p.activity[date] ??= { c: 0, i: 0 });
  day.c += correctCount;
  day.i += totalCount - correctCount;
  p.lifetime.solved += totalCount;
  p.lifetime.correct += correctCount;
  save(p);
}

export function recordModuleFinishPending() {
  const p = loadPending();
  p.modulesDirty = true;
  save(p);
}

/**
 * A subject was cleared. Drop any queued answers for it (they no longer
 * exist) and remember the clear so other devices learn about it.
 */
export function recordClearPending(exam: string, subject: string) {
  const p = loadPending();
  if (p.answers[exam]) {
    delete p.answers[exam][subject];
    if (Object.keys(p.answers[exam]).length === 0) delete p.answers[exam];
  }
  p.cleared[`${exam}.${subject}`] = Date.now();
  save(p);
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

/** Push succeeded: clear the log but keep the sync time. */
export function markSynced(at = Date.now()) {
  save({ ...empty(), lastSync: at });
}

/** Sign-out / account switch: forget everything, including lastSync. */
export function resetPending() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  notify();
}
