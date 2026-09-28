import { arrayRemove, arrayUnion, doc, getDoc, increment, setDoc } from "firebase/firestore";
import { useSyncExternalStore } from "react";
import { db as firestore } from "./firebase";
import { auth } from "./auth";
import {
  clearAllLocalData,
  getLocalSnapshot,
  isSnapshotEmpty,
  mergeCloudIntoLocal,
  replaceLocalData,
} from "./db";
import { decodeSnapshot, encodeSnapshot, type CloudProgress } from "./cloudShape";
import {
  hasPending,
  loadPending,
  markSynced,
  resetPending,
  subscribePending,
  type Pending,
} from "./pending";

/**
 * Cloud sync rules:
 *  - Signed out: IndexedDB only, nothing touches Firestore.
 *  - First-ever sign-in (empty cloud doc): upload the full local snapshot.
 *  - Sign-in to an account that already has cloud data: cloud REPLACES local.
 *    No merging across accounts, so signing in on someone else's device can
 *    never pull their data into your account.
 *  - While signed in, changes are queued in the pending log (pending.ts) and
 *    pushed as small field-level writes (arrayUnion / increment), so devices
 *    of the same user never overwrite each other.
 *  - Pushes are gated: only if something changed AND 15 minutes have passed
 *    since the last push. Module finish, Clear Progress and sign-out bypass
 *    the 15-minute wait (they still need something to send).
 *  - On app open a signed-in device pulls the cloud doc and folds in what
 *    other devices did (union; subject clears honoured).
 */

export const MIN_PUSH_INTERVAL_MS = 15 * 60 * 1000;
const RECONCILED_KEY = (uid: string) => `medicetamol:reconciled:${uid}`;

const progressRef = (uid: string) => doc(firestore, "users", uid, "data", "progress");

// ─── Status store (drives sync buttons, Settings line, sign-out modal) ──────

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

let status = "idle" as SyncStatus;
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const off = subscribePending(l);
  return () => {
    listeners.delete(l);
    off();
  };
}

export interface SyncSnapshot {
  status: SyncStatus;
  lastSync: number | null;
  /** something is queued and waiting to be pushed */
  dirty: boolean;
  /** ms until a push is allowed again (0 = allowed) */
  waitMs: number;
  /** the sync button should be enabled */
  canSync: boolean;
}

function computeSnapshot(): SyncSnapshot {
  const p = loadPending();
  const dirty = hasPending(p);
  const waitMs = p.lastSync ? Math.max(0, MIN_PUSH_INTERVAL_MS - (Date.now() - p.lastSync)) : 0;
  return {
    status,
    lastSync: p.lastSync,
    dirty,
    waitMs,
    canSync: status !== "syncing" && dirty && waitMs === 0,
  };
}

// useSyncExternalStore needs a stable reference between real changes.
let cached = computeSnapshot();
function getSnapshot(): SyncSnapshot {
  const next = computeSnapshot();
  if (
    next.status !== cached.status ||
    next.lastSync !== cached.lastSync ||
    next.dirty !== cached.dirty ||
    next.canSync !== cached.canSync
  ) {
    cached = next;
  }
  return cached;
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ─── Push ───────────────────────────────────────────────────────────────────

let inFlight: Promise<void> | null = null;

/** Turn the pending log into field-level Firestore writes. */
async function writePending(uid: string, p: Pending, includeModules: boolean) {
  const payload: Record<string, unknown> = { updatedAt: Date.now() };

  const answers: Record<string, Record<string, unknown>> = {};
  for (const [exam, subjects] of Object.entries(p.answers)) {
    for (const [subject, b] of Object.entries(subjects)) {
      (answers[exam] ??= {})[subject] = {
        ...(b.correct.length ? { correct: arrayUnion(...b.correct) } : {}),
        ...(Object.keys(b.incorrect).length ? { incorrect: b.incorrect } : {}),
      };
    }
  }
  if (Object.keys(answers).length) payload.answers = answers;

  if (p.bookmarkAdd.length) payload.bookmark = arrayUnion(...p.bookmarkAdd);

  const activity: Record<string, unknown> = {};
  for (const [date, d] of Object.entries(p.activity)) {
    activity[date] = { c: increment(d.c), i: increment(d.i) };
  }
  if (Object.keys(activity).length) payload.activity = activity;

  if (p.lifetime.solved > 0) {
    payload.lifetime = {
      totalSolved: increment(p.lifetime.solved),
      totalCorrect: increment(p.lifetime.correct),
    };
  }

  if (includeModules) {
    payload.modules = (await getLocalSnapshot()).modules;
  }

  await setDoc(progressRef(uid), payload, { merge: true });

  // arrayRemove can't share a write with arrayUnion on the same field.
  if (p.bookmarkRemove.length) {
    await setDoc(
      progressRef(uid),
      { bookmark: arrayRemove(...p.bookmarkRemove), updatedAt: Date.now() },
      { merge: true },
    );
  }
}

/** Wipe cleared subjects in the cloud and stamp clearedAt so other devices follow. */
async function writeClears(uid: string, cleared: Record<string, number>) {
  const answers: Record<string, Record<string, unknown>> = {};
  const clearedAt: Record<string, Record<string, number>> = {};
  for (const [key, at] of Object.entries(cleared)) {
    const [exam, subject] = key.split(".");
    (answers[exam] ??= {})[subject] = { correct: [], incorrect: {} };
    (clearedAt[exam] ??= {})[subject] = at;
  }
  await setDoc(progressRef(uid), { answers, clearedAt, updatedAt: Date.now() }, { merge: true });
}

interface PushOptions {
  /** skip the 15-minute wait (module finish, clear, sign-out) */
  bypassInterval?: boolean;
  /** also rewrite the finished-modules list */
  includeModules?: boolean;
}

/** Returns true if a write happened. Serialised so pushes never overlap. */
export async function push(uid: string, opts: PushOptions = {}): Promise<boolean> {
  while (inFlight) await inFlight.catch(() => undefined);

  const p = loadPending();
  if (!hasPending(p)) return false;
  if (!opts.bypassInterval && p.lastSync && Date.now() - p.lastSync < MIN_PUSH_INTERVAL_MS) {
    return false;
  }

  const run = (async () => {
    setStatus("syncing");
    try {
      // Clears first, so answers queued after a clear aren't wiped by it.
      if (Object.keys(p.cleared).length) await writeClears(uid, p.cleared);
      await writePending(uid, p, opts.includeModules ?? p.modulesDirty);
      markSynced();
      setStatus("synced");
    } catch (err) {
      setStatus("error");
      throw err;
    }
  })();
  inFlight = run;
  try {
    await run;
    return true;
  } finally {
    inFlight = null;
  }
}

// ─── Sign-in / app-open ─────────────────────────────────────────────────────

async function uploadFullSnapshot(uid: string) {
  setStatus("syncing");
  try {
    await setDoc(progressRef(uid), encodeSnapshot(await getLocalSnapshot()));
    markSynced();
    setStatus("synced");
  } catch (err) {
    setStatus("error");
    throw err;
  }
}

/**
 * Once per fresh sign-in. Empty cloud -> upload local. Cloud has data -> it
 * replaces local. Returns true if the local store was replaced.
 */
export async function reconcileOnSignIn(uid: string): Promise<boolean> {
  setStatus("syncing");
  try {
    const snap = await getDoc(progressRef(uid));
    if (!snap.exists()) {
      const local = await getLocalSnapshot();
      if (!isSnapshotEmpty(local)) await uploadFullSnapshot(uid);
      else {
        markSynced();
        setStatus("synced");
      }
      return false;
    }
    await replaceLocalData(decodeSnapshot(snap.data() as Partial<CloudProgress>));
    markSynced();
    setStatus("synced");
    return true;
  } catch (err) {
    console.error("Sign-in sync failed", err);
    setStatus("error");
    return false;
  }
}

/**
 * App open for a signed-in returning device: pull the cloud doc, fold in what
 * other devices did, then push our own queued changes if the gate allows.
 * Returns true if local data changed.
 */
export async function pullAndPush(uid: string): Promise<boolean> {
  let changed = false;
  try {
    const snap = await getDoc(progressRef(uid));
    if (snap.exists()) {
      const cloud = snap.data() as Partial<CloudProgress> & {
        clearedAt?: Record<string, Record<string, number>>;
      };
      const p = loadPending();
      // Subjects cleared on another device after our last sync are dropped here.
      const clearedRemote: string[] = [];
      for (const [exam, subjects] of Object.entries(cloud.clearedAt ?? {})) {
        for (const [subject, at] of Object.entries(subjects)) {
          if (p.lastSync !== null && at > p.lastSync && !p.cleared[`${exam}.${subject}`]) {
            clearedRemote.push(`${exam}${subject}`);
          }
        }
      }
      changed = await mergeCloudIntoLocal(decodeSnapshot(cloud), clearedRemote);
    }
  } catch (err) {
    console.error("Pull on open failed", err);
  }
  try {
    await push(uid);
  } catch (err) {
    console.error("Push on open failed", err);
  }
  return changed;
}

// ─── Triggers ───────────────────────────────────────────────────────────────

/** App went to the background: push if the gate allows. */
export async function pushOnBackground(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await push(user.uid);
  } catch (err) {
    console.error("Background sync failed", err);
  }
}

/** A custom module was just finished: push right away (only when signed in). */
export async function syncAfterModuleFinish(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await push(user.uid, { bypassInterval: true, includeModules: true });
  } catch (err) {
    console.error("Module-finish sync failed", err);
  }
}

/** Progress was cleared: a major change, push immediately. */
export async function syncAfterClear(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await push(user.uid, { bypassInterval: true });
  } catch (err) {
    console.error("Clear sync failed", err);
  }
}

/** Manual "Sync now" button. */
export async function manualSync(): Promise<"synced" | "already-synced" | "error"> {
  const user = auth.currentUser;
  if (!user || !computeSnapshot().canSync) return "already-synced";
  try {
    return (await push(user.uid)) ? "synced" : "already-synced";
  } catch {
    return "error";
  }
}

// ─── Sign-out ───────────────────────────────────────────────────────────────

/** Sign-out step 1: make sure the cloud copy is current. Throws if it can't be. */
export async function flushForSignOut(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await push(user.uid, { bypassInterval: true, includeModules: true });
}

/** Sign-out step 2 (after the user confirms): wipe this device's data. */
export async function wipeLocalAfterSignOut(uid?: string): Promise<void> {
  await clearAllLocalData();
  resetPending();
  if (uid) localStorage.removeItem(RECONCILED_KEY(uid));
  setStatus("idle");
}
