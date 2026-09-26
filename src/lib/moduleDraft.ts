// ─── Custom module draft (localStorage) ─────────────────────────────────────
// Live in-progress answers for the single currently-resumable custom module.
// Cheap, synchronous, updated on every question navigation — kept OUT of
// IndexedDB until Final Submit to avoid a transactional write on every tap.
// See CustomModuleHistoryEntry (types.ts) for the IndexedDB-side shape this
// eventually gets folded into.

const DRAFT_KEY = "medicetamol-module-draft";

export interface ModuleDraft {
  id: string; // matches CustomModuleHistoryEntry.id (== startedAt)
  answers: (number | null)[]; // parallel to the entry's questionIds
  lastIndex: number; // question the user was last on — resume lands here, not on a derived guess
  globalSecondsLeft?: number; // Exam mode only: countdown remaining at last checkpoint, restored as-is on resume (not recomputed from wall-clock elapsed)
  reviewedQids?: string[]; // Reviewed self-tags at last checkpoint — entry.reviewedQids only gets written at finish, so this draft is the only place an in-progress module's tags live
  guessedQids?: string[]; // Guessing self-tags at last checkpoint, same reasoning as reviewedQids
  // Score snapshot at last checkpoint. entry.correctCount/incorrectCount/skippedCount
  // in IndexedDB are ONLY ever written at creation (all zero/skipped) and at
  // finishQuiz — an abandoned module (superseded by a new one, or left past its
  // resume window and never reopened) never reaches finishQuiz, so without this
  // the history row is stuck showing 0% solved forever instead of real progress.
  correctCount?: number;
  incorrectCount?: number;
  skippedCount?: number;
}

export function readModuleDraft(id: string): ModuleDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModuleDraft;
    return parsed.id === id ? parsed : null;
  } catch {
    return null;
  }
}

// Unlike readModuleDraft, doesn't filter by id — used to detect a leftover
// draft belonging to a DIFFERENT (presumably abandoned) module, e.g. right
// before a new module's beginQuiz overwrites/clears the single draft slot.
export function readAnyModuleDraft(): ModuleDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ModuleDraft;
  } catch {
    return null;
  }
}

export function writeModuleDraft(draft: ModuleDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full/unavailable: draft simply won't resume. Never break the quiz over this.
  }
}

export function clearModuleDraft(id?: string): void {
  try {
    if (id) {
      const existing = readModuleDraft(id);
      if (!existing) return; // a different module's draft — don't clear it
    }
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
