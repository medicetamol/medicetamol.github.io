import { doc, getDoc, setDoc } from "firebase/firestore";
import { useSyncExternalStore } from "react";
import { db as firestore } from "./firebase";
import { auth } from "./auth";
import {
  clearAllLocalData,
  getLocalSnapshot,
  isSnapshotEmpty,
  replaceLocalData,
} from "./db";
import { decodeSnapshot, encodeSnapshot, type CloudProgress } from "./cloudShape";

/**
 * Cloud sync rules (see project notes):
 *  - Signed out: IndexedDB only, nothing touches Firestore.
 *  - First-ever sign-in (empty cloud doc): upload local progress.
 *  - Sign-in to an account that already has cloud data: cloud REPLACES local.
 *    No merging — so signing in on someone else's device can never pull their
 *    data into your account.
 *  - While signed in: one batched write at most once per 24h (on app load),
 *    plus one write each time a custom module is finished.
 *  - Sign-out: flush to cloud, then wipe local data.
 */

const LAST_SYNC_KEY = "medicetamol:lastCloudSync";
const DAY_MS = 24 * 60 * 60 * 1000;

const progressRef = (uid: string) => doc(firestore, "users", uid, "data", "progress");

// ─── Status store (drives the Settings line + sign-out modal) ───────────────

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

let status = "idle" as SyncStatus;
let lastSyncedAt = null as number | null;
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus) {
  status = next;
  if (next === "synced") lastSyncedAt = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// useSyncExternalStore needs a stable snapshot reference between changes.
let cached: { status: SyncStatus; lastSyncedAt: number | null } = { status, lastSyncedAt };
function getSnapshot() {
  if (cached.status !== status || cached.lastSyncedAt !== lastSyncedAt) {
    cached = { status, lastSyncedAt };
  }
  return cached;
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ─── Core operations ────────────────────────────────────────────────────────

let inFlight: Promise<void> | null = null;

/** Push the whole local snapshot to the cloud doc. Serialised so writes never overlap. */
export async function pushToCloud(uid: string): Promise<void> {
  while (inFlight) await inFlight.catch(() => undefined);
  const run = (async () => {
    setStatus("syncing");
    try {
      const snapshot = await getLocalSnapshot();
      await setDoc(progressRef(uid), encodeSnapshot(snapshot));
      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      setStatus("synced");
    } catch (err) {
      setStatus("error");
      throw err;
    }
  })();
  inFlight = run;
  try {
    await run;
  } finally {
    inFlight = null;
  }
}

/**
 * Runs once per sign-in. Empty cloud -> upload local. Cloud has data -> it
 * replaces local. Returns true if the local store was replaced (callers may
 * want to refresh any open page).
 */
export async function reconcileOnSignIn(uid: string): Promise<boolean> {
  setStatus("syncing");
  try {
    const snap = await getDoc(progressRef(uid));
    if (!snap.exists()) {
      // First-ever sign-in: cloud is empty, so this device's progress becomes the account's.
      const local = await getLocalSnapshot();
      if (!isSnapshotEmpty(local)) await pushToCloud(uid);
      else setStatus("synced");
      return false;
    }
    await replaceLocalData(decodeSnapshot(snap.data() as Partial<CloudProgress>));
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    setStatus("synced");
    return true;
  } catch (err) {
    console.error("Sign-in sync failed", err);
    setStatus("error");
    return false;
  }
}

/** Once per 24h while signed in: call on app load. */
export async function syncIfDue(uid: string): Promise<void> {
  const last = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0);
  if (Date.now() - last < DAY_MS) return;
  try {
    await pushToCloud(uid);
  } catch (err) {
    console.error("Daily sync failed", err);
  }
}

/** Called right after a custom module is finished (only syncs when signed in). */
export async function syncAfterModuleFinish(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await pushToCloud(user.uid);
  } catch (err) {
    console.error("Module-finish sync failed", err);
  }
}

/** Sign-out step 1: make sure the cloud copy is current. Throws if it can't be. */
export async function flushForSignOut(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await pushToCloud(user.uid);
}

/** Sign-out step 2 (after the user confirms): wipe this device's data. */
export async function wipeLocalAfterSignOut(): Promise<void> {
  await clearAllLocalData();
  localStorage.removeItem(LAST_SYNC_KEY);
  setStatus("idle");
}
